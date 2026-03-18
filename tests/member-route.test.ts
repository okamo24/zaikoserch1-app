import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createSupabaseServerClient = vi.fn(async () => ({
  auth: {
    getUser,
  },
}));
const fetchProfileById = vi.fn();
const createSupabaseAdminClient = vi.fn();
const buildAuditActor = vi.fn(() => ({
  userId: "admin-1",
  email: "admin@example.com",
  role: "admin",
}));
const writeAuditLogSafe = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient,
}));

vi.mock("@/lib/supabase/queries", () => ({
  fetchProfileById,
}));

vi.mock("@/lib/audit", () => ({
  buildAuditActor,
  writeAuditLogSafe,
}));

function createProfilesTableMock({
  target,
  adminCount = 2,
}: {
  target: Record<string, unknown>;
  adminCount?: number;
}) {
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
            data: target,
            error: null,
          }),
        })),
      };
    }),
    update: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
    delete: vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    })),
  };
}

function createAdminClientMock({
  target,
  adminCount = 2,
}: {
  target: Record<string, unknown>;
  adminCount?: number;
}) {
  return {
    from: vi.fn((table: string) => {
      if (table !== "profiles") {
        throw new Error(`Unexpected table: ${table}`);
      }

      return createProfilesTableMock({ target, adminCount });
    }),
    auth: {
      admin: {
        getUserById: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  };
}

describe("member admin route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "admin-1",
          email: "admin@example.com",
        },
      },
    });
    fetchProfileById.mockResolvedValue({
      id: "admin-1",
      email: "admin@example.com",
      full_name: "Admin User",
      role: "admin",
      is_approved: true,
      approved_at: null,
      deleted_at: null,
      created_at: "",
      updated_at: "",
    });
  });

  it("prevents an admin from demoting themselves", async () => {
    createSupabaseAdminClient.mockReturnValue(
      createAdminClientMock({
        target: {
          id: "admin-1",
          email: "admin@example.com",
          role: "admin",
          is_approved: true,
          approved_at: null,
          deleted_at: null,
        },
      }),
    );

    const { PATCH } = await import("@/app/api/admin/members/[id]/route");
    const response = await PATCH(
      new Request("https://example.com/api/admin/members/admin-1", {
        method: "PATCH",
        body: JSON.stringify({
          action: "role",
          role: "user",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      { params: Promise.resolve({ id: "admin-1" }) },
    );

    expect(response.status).toBe(400);
    expect(writeAuditLogSafe).not.toHaveBeenCalled();
  });

  it("rejects non-admin users from the member admin API", async () => {
    fetchProfileById.mockResolvedValue({
      id: "user-1",
      email: "user@example.com",
      full_name: "Standard User",
      role: "user",
      is_approved: true,
      approved_at: null,
      deleted_at: null,
      created_at: "",
      updated_at: "",
    });

    const { PATCH } = await import("@/app/api/admin/members/[id]/route");
    const response = await PATCH(
      new Request("https://example.com/api/admin/members/user-2", {
        method: "PATCH",
        body: JSON.stringify({
          action: "approve",
        }),
        headers: {
          "content-type": "application/json",
        },
      }),
      { params: Promise.resolve({ id: "user-2" }) },
    );

    expect(response.status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(writeAuditLogSafe).not.toHaveBeenCalled();
  });

  it("prevents an admin from deleting themselves", async () => {
    createSupabaseAdminClient.mockReturnValue(
      createAdminClientMock({
        target: {
          id: "admin-1",
          email: "admin@example.com",
          role: "admin",
          deleted_at: null,
        },
      }),
    );

    const { DELETE } = await import("@/app/api/admin/members/[id]/route");
    const response = await DELETE(
      new Request("https://example.com/api/admin/members/admin-1", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "admin-1" }) },
    );

    expect(response.status).toBe(400);
    expect(writeAuditLogSafe).not.toHaveBeenCalled();
  });

  it("prevents deleting the last active admin", async () => {
    createSupabaseAdminClient.mockReturnValue(
      createAdminClientMock({
        target: {
          id: "admin-2",
          email: "other-admin@example.com",
          role: "admin",
          deleted_at: null,
        },
        adminCount: 1,
      }),
    );

    const { DELETE } = await import("@/app/api/admin/members/[id]/route");
    const response = await DELETE(
      new Request("https://example.com/api/admin/members/admin-2", {
        method: "DELETE",
      }),
      { params: Promise.resolve({ id: "admin-2" }) },
    );

    expect(response.status).toBe(400);
    expect(writeAuditLogSafe).not.toHaveBeenCalled();
  });
});
