import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const appendFile = vi.fn();
const mkdir = vi.fn();
const readFile = vi.fn();
const writeFile = vi.fn();
const insert = vi.fn();
const createSupabaseAdminClient = vi.fn(() => ({
  from: vi.fn(() => ({
    insert,
  })),
}));

vi.mock("node:fs/promises", () => ({
  appendFile,
  mkdir,
  readFile,
  writeFile,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

describe("audit logging", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    insert.mockResolvedValue({ error: null });
    readFile.mockResolvedValue("");
  });

  afterEach(() => {
    delete process.env.AUDIT_LOG_RETENTION_DAYS;
  });

  it("masks IP, summarizes user agent, and redacts raw search query values", async () => {
    const { writeAuditLog } = await import("@/lib/audit");

    await writeAuditLog({
      actor: {
        userId: "user-1",
        email: "admin@example.com",
        name: "Admin User",
        role: "admin",
      },
      action: "inventory.search",
      resourceType: "inventory",
      status: "success",
      detail: {
        query: "1234567890123",
        state: "single",
        totalCount: 1,
      },
      request: new Request("https://example.com/api/search", {
        headers: {
          "x-forwarded-for": "203.0.113.55",
          "user-agent":
            "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1",
        },
      }),
    });

    expect(insert).toHaveBeenCalledWith(
      expect.objectContaining({
        actor_user_id: "user-1",
        actor_email: "admin@example.com",
        actor_name: null,
        actor_role: "admin",
        ip_address: "203.0.113.0",
        user_agent: "Safari/mobile",
        detail: {
          state: "single",
          totalCount: 1,
          query_length: 13,
          query_type: "barcode",
        },
      }),
    );
    expect(appendFile).toHaveBeenCalledWith(
      expect.stringContaining("logs"),
      expect.stringContaining("\"query_type\":\"barcode\""),
      "utf8",
    );
    expect(appendFile).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining("1234567890123"),
      "utf8",
    );
  });

  it("prunes local audit log lines older than the retention period before appending", async () => {
    process.env.AUDIT_LOG_RETENTION_DAYS = "30";
    const oldTimestamp = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    const recentTimestamp = new Date().toISOString();
    readFile.mockResolvedValue(
      `${JSON.stringify({ timestamp: oldTimestamp, action: "old" })}\n` +
        `${JSON.stringify({ timestamp: recentTimestamp, action: "recent" })}\n`,
    );

    const { writeAuditLog } = await import("@/lib/audit");

    await writeAuditLog({
      actor: {
        userId: "user-2",
        email: "user@example.com",
        role: "user",
      },
      action: "member.deleted",
      resourceType: "member",
      status: "success",
      detail: {
        targetEmail: "target@example.com",
      },
    });

    expect(writeFile).toHaveBeenCalledWith(
      expect.stringContaining("logs"),
      `${JSON.stringify({ timestamp: recentTimestamp, action: "recent" })}\n`,
      "utf8",
    );
    expect(appendFile).toHaveBeenCalledTimes(1);
  });
});
