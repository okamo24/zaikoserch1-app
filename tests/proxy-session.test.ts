import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const getUser = vi.fn();
const maybeSingle = vi.fn();
const createServerClient = vi.fn(() => ({
  auth: {
    getUser,
  },
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle,
      })),
    })),
  })),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient,
}));

vi.mock("@/lib/supabase/env", () => ({
  getSupabaseUrl: () => "https://example.supabase.co",
  getSupabasePublishableKey: () => "publishable-key",
}));

describe("updateSession", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("redirects unauthenticated users from protected pages to login", async () => {
    getUser.mockResolvedValue({
      data: {
        user: null,
      },
      error: null,
    });

    const { updateSession } = await import("@/lib/supabase/proxy");
    const response = await updateSession(
      new NextRequest("https://example.com/chat?q=abc"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://example.com/login?next=%2Fchat%3Fq%3Dabc",
    );
  });

  it("redirects deleted users away from protected pages to auth error", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-1",
          email: "deleted@example.com",
        },
      },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: {
        role: "user",
        is_approved: true,
        deleted_at: "2026-03-17T00:00:00.000Z",
      },
    });

    const { updateSession } = await import("@/lib/supabase/proxy");
    const response = await updateSession(new NextRequest("https://example.com/chat"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("https://example.com/auth/error?");
    expect(response.headers.get("location")).toContain("next=%2Fchat");
  });

  it("redirects pending users away from protected pages to auth error", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-2",
          email: "pending@example.com",
        },
      },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: {
        role: "user",
        is_approved: false,
        deleted_at: null,
      },
    });

    const { updateSession } = await import("@/lib/supabase/proxy");
    const response = await updateSession(new NextRequest("https://example.com/items/abc"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("https://example.com/auth/error?");
    expect(response.headers.get("location")).toContain("next=%2Fchat");
  });

  it("redirects non-admin users away from admin pages to chat", async () => {
    getUser.mockResolvedValue({
      data: {
        user: {
          id: "user-3",
          email: "user@example.com",
        },
      },
      error: null,
    });
    maybeSingle.mockResolvedValue({
      data: {
        role: "user",
        is_approved: true,
        deleted_at: null,
      },
    });

    const { updateSession } = await import("@/lib/supabase/proxy");
    const response = await updateSession(
      new NextRequest("https://example.com/admin/logs"),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://example.com/chat");
  });
});
