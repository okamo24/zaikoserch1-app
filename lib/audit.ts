import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AuditLogStatus, Profile } from "@/lib/types";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

interface AuditRequestMetadata {
  ipAddress: string | null;
  userAgent: string | null;
}

interface AuditActor {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
  role?: string | null;
}

interface AuditLogInput {
  actor?: AuditActor;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  resourceLabel?: string | null;
  status?: AuditLogStatus;
  detail?: Record<string, unknown>;
  request?: Request | Headers;
  requestMetadata?: Partial<AuditRequestMetadata>;
}

interface AuditLogRecord {
  timestamp: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_label: string | null;
  status: AuditLogStatus;
  detail: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
}

const AUDIT_LOG_DIR = path.join(process.cwd(), "logs");
const AUDIT_LOG_PATH = path.join(AUDIT_LOG_DIR, "audit.ndjson");
const DEFAULT_AUDIT_RETENTION_DAYS = 90;

function getAuditRetentionDays(): number {
  const raw = Number(process.env.AUDIT_LOG_RETENTION_DAYS);

  if (!Number.isFinite(raw) || raw < 1) {
    return DEFAULT_AUDIT_RETENTION_DAYS;
  }

  return Math.floor(raw);
}

function readHeader(source: Request | Headers, key: string): string | null {
  if (source instanceof Request) {
    return source.headers.get(key);
  }

  return source.get(key);
}

function isMissingAuditLogTable(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const value = error as { code?: string; message?: string };
  return (
    value.code === "PGRST205" ||
    value.message?.includes("public.audit_logs") === true
  );
}

export function extractAuditRequestMetadata(
  source?: Request | Headers | null,
): AuditRequestMetadata {
  if (!source) {
    return {
      ipAddress: null,
      userAgent: null,
    };
  }

  const forwardedFor = readHeader(source, "x-forwarded-for");
  const realIp = readHeader(source, "x-real-ip");
  const ipAddress = forwardedFor?.split(",")[0]?.trim() || realIp || null;

  return {
    ipAddress,
    userAgent: readHeader(source, "user-agent"),
  };
}

export function buildAuditActor(
  user: { id: string; email?: string | null } | null,
  profile?: Profile | null,
): AuditActor {
  return {
    userId: user?.id ?? null,
    email: profile?.email ?? user?.email ?? null,
    name: null,
    role: profile?.role ?? null,
  };
}

function maskIpAddress(ipAddress: string | null): string | null {
  if (!ipAddress) {
    return null;
  }

  if (ipAddress.includes(".")) {
    const parts = ipAddress.split(".");
    if (parts.length === 4) {
      return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
    }
  }

  if (ipAddress.includes(":")) {
    const parts = ipAddress.split(":").filter(Boolean);
    if (parts.length > 0) {
      return `${parts.slice(0, 4).join(":")}::*`;
    }
  }

  return null;
}

function summarizeUserAgent(userAgent: string | null): string | null {
  if (!userAgent) {
    return null;
  }

  const device = /mobile|iphone|android/i.test(userAgent) ? "mobile" : "desktop";

  if (/edg\//i.test(userAgent)) {
    return `Edge/${device}`;
  }

  if (/chrome\//i.test(userAgent) && !/edg\//i.test(userAgent)) {
    return `Chrome/${device}`;
  }

  if (/safari\//i.test(userAgent) && !/chrome\//i.test(userAgent)) {
    return `Safari/${device}`;
  }

  if (/firefox\//i.test(userAgent)) {
    return `Firefox/${device}`;
  }

  return `Other/${device}`;
}

function classifySearchQuery(query: string): string {
  const trimmed = query.trim();

  if (!trimmed) {
    return "empty";
  }

  if (/^\d+$/.test(trimmed)) {
    if (trimmed.length >= 13) {
      return "barcode";
    }

    return "code";
  }

  if (/^[A-Za-z0-9-]+$/.test(trimmed)) {
    return "alphanumeric";
  }

  return "text";
}

function sanitizeDetail(
  action: string,
  detail: Record<string, unknown> | undefined,
): Record<string, unknown> {
  if (!detail) {
    return {};
  }

  if (action !== "inventory.search") {
    return detail;
  }

  const { query, ...rest } = detail;

  if (typeof query !== "string") {
    return rest;
  }

  return {
    ...rest,
    query_length: query.trim().length,
    query_type: classifySearchQuery(query),
  };
}

async function pruneAuditLogFile(retentionDays: number) {
  try {
    const content = await readFile(AUDIT_LOG_PATH, "utf8");
    const cutoffTime = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    const keptLines = content
      .split(/\r?\n/)
      .filter(Boolean)
      .filter((line) => {
        try {
          const parsed = JSON.parse(line) as { timestamp?: string };
          const timestamp = parsed.timestamp ? Date.parse(parsed.timestamp) : Number.NaN;
          return Number.isFinite(timestamp) && timestamp >= cutoffTime;
        } catch {
          return false;
        }
      });

    await writeFile(
      AUDIT_LOG_PATH,
      keptLines.length > 0 ? `${keptLines.join("\n")}\n` : "",
      "utf8",
    );
  } catch (error) {
    const value = error as NodeJS.ErrnoException;
    if (value?.code !== "ENOENT") {
      throw error;
    }
  }
}

function buildAuditRecord(
  input: AuditLogInput,
  metadata: AuditRequestMetadata,
): AuditLogRecord {
  return {
    timestamp: new Date().toISOString(),
    actor_user_id: input.actor?.userId ?? null,
    actor_email: input.actor?.email ?? null,
    actor_name: null,
    actor_role: input.actor?.role ?? null,
    action: input.action,
    resource_type: input.resourceType,
    resource_id: input.resourceId ?? null,
    resource_label: input.resourceLabel ?? null,
    status: input.status ?? "info",
    detail: sanitizeDetail(input.action, input.detail),
    ip_address: maskIpAddress(metadata.ipAddress ?? null),
    user_agent: summarizeUserAgent(metadata.userAgent ?? null),
  };
}

async function writeAuditLogToFile(record: AuditLogRecord) {
  await mkdir(AUDIT_LOG_DIR, { recursive: true });
  await pruneAuditLogFile(getAuditRetentionDays());
  await appendFile(AUDIT_LOG_PATH, `${JSON.stringify(record)}\n`, "utf8");
}

export async function writeAuditLog(input: AuditLogInput) {
  const admin = createSupabaseAdminClient();
  const metadata = {
    ...extractAuditRequestMetadata(input.request),
    ...input.requestMetadata,
  };
  const record = buildAuditRecord(input, metadata);

  await writeAuditLogToFile(record);

  const { error } = await admin.from("audit_logs").insert({
    actor_user_id: record.actor_user_id,
    actor_email: record.actor_email,
    actor_name: record.actor_name,
    actor_role: record.actor_role,
    action: record.action,
    resource_type: record.resource_type,
    resource_id: record.resource_id,
    resource_label: record.resource_label,
    status: record.status,
    detail: record.detail,
    ip_address: record.ip_address,
    user_agent: record.user_agent,
  });

  if (error) {
    throw error;
  }
}

export async function writeAuditLogSafe(input: AuditLogInput) {
  try {
    await writeAuditLog(input);
  } catch (error) {
    if (isMissingAuditLogTable(error)) {
      return;
    }

    console.error("Failed to write audit log", error);
  }
}
