import { beforeEach, describe, expect, it, vi } from "vitest";

const exchangeCodeForSession = vi.fn();
const signOut = vi.fn();
const createSupabaseServerClient = vi.fn(async () => ({
  auth: {
    exchangeCodeForSession,
    signOut,
  },
}));
const createSupabaseAdminClient = vi.fn();
const isAllowedEmail = vi.fn();
const getAllowedEmailError = vi.fn(() => "許可されていないメールアドレスです。");
const writeAuditLogSafe = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/lib/auth/allowlist", () => ({
  isAllowedEmail,
  getAllowedEmailError,
}));

vi.mock("@/lib/audit", () => ({
  writeAuditLogSafe,
}));

function createCallbackAdminClient({
  adminCount = 1,
  existingProfile = null,
  upsertError = null,
}: {
  adminCount?: number;
  existingProfile?:
    | {
        role: "admin" | "user";
        is_approved: boolean;
        approved_at: string | null;
        deleted_at: string | null;
      }
    | null;
  upsertError?: Error | null;
}) {
  const upsert = vi.fn().mockResolvedValue({ error: upsertError });

  return {
    from: vi.fn((table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return {
        select: vi.fn((_: string, options?: { count?: string; head?: boolean }) => {
          if (options?.count === "exact") {
            return {
              eq: vi.fn(() => ({
                is: vi.fn().mockResolvedValue({
                  count: adminCount,
                  error: null,
                }),
              })),
            };
          }

          return {
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({
                data: existingProfile,
                error: null,
              }),
            })),
          };
        }),
        upsert,
      };
    }),
    calls: {
      upsert,
    },
  };
}

describe("auth callback route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    signOut.mockResolvedValue({ error: null });
    createSupabaseAdminClient.mockImplementation(() => {
      throw new Error("admin client should not be called");
    });
  });

  it("rejects users outside the allowlist before profile bootstrap", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "blocked@example.com",
          user_metadata: {
            full_name: "Blocked User",
          },
        },
      },
      error: null,
    });
    isAllowedEmail.mockReturnValue(false);

    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request("https://example.com/auth/callback?code=test-code&next=%2Fchat") as never,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/error?");
    expect(response.headers.get("location")).toContain(
      encodeURIComponent("許可されていないメールアドレスです。"),
    );
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(writeAuditLogSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "auth.access_denied",
        status: "failure",
        detail: expect.objectContaining({
          reason: "allowlist_denied",
        }),
      }),
    );
  });

  it("blocks deleted users after callback and signs them out", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "deleted@example.com",
          user_metadata: {
            full_name: "Deleted User",
          },
        },
      },
      error: null,
    });
    isAllowedEmail.mockReturnValue(true);
    const adminMock = createCallbackAdminClient({
      adminCount: 1,
      existingProfile: {
        role: "user",
        is_approved: true,
        approved_at: "2026-03-17T00:00:00.000Z",
        deleted_at: "2026-03-17T01:00:00.000Z",
      },
    });
    createSupabaseAdminClient.mockReturnValue(adminMock);

    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request("https://example.com/auth/callback?code=test-code&next=%2Fchat") as never,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/error?");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(adminMock.calls.upsert).toHaveBeenCalledTimes(1);
    expect(writeAuditLogSafe).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "auth.access_denied",
        status: "failure",
        detail: expect.objectContaining({
          reason: "deleted_account",
        }),
      }),
    );
  });

  it("blocks pending users after callback and signs them out", async () => {
    exchangeCodeForSession.mockResolvedValue({
      data: {
        user: {
          id: "user-3",
          email: "pending@example.com",
          user_metadata: {
            full_name: "Pending User",
          },
        },
      },
      error: null,
    });
    isAllowedEmail.mockReturnValue(true);
    const adminMock = createCallbackAdminClient({
      adminCount: 1,
      existingProfile: {
        role: "user",
        is_approved: false,
        approved_at: null,
        deleted_at: null,
      },
    });
    createSupabaseAdminClient.mockReturnValue(adminMock);

    const { GET } = await import("@/app/auth/callback/route");
    const response = await GET(
      new Request("https://example.com/auth/callback?code=test-code&next=%2Fchat") as never,
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/auth/error?");
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(adminMock.calls.upsert).toHaveBeenCalledTimes(1);
    expect(writeAuditLogSafe).toHaveBeenLastCalledWith(
      expect.objectContaining({
        action: "auth.access_denied",
        status: "failure",
        detail: expect.objectContaining({
          reason: "pending_approval",
        }),
      }),
    );
  });
});
