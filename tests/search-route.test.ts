import { beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const createSupabaseServerClient = vi.fn(async () => ({
  auth: {
    getUser,
  },
}));
const fetchProfileById = vi.fn();
const fetchLatestSuccessfulImport = vi.fn();
const fetchInventorySummary = vi.fn();
const searchInventory = vi.fn();
const buildAuditActor = vi.fn(() => ({
  userId: "user-1",
  email: "admin@example.com",
  role: "admin",
}));
const writeAuditLogSafe = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/queries", () => ({
  fetchProfileById,
  fetchLatestSuccessfulImport,
  fetchInventorySummary,
  searchInventory,
}));

vi.mock("@/lib/audit", () => ({
  buildAuditActor,
  writeAuditLogSafe,
}));

function mockAuthenticatedUser() {
  getUser.mockResolvedValue({
    data: {
      user: {
        id: "user-1",
        email: "admin@example.com",
      },
    },
  });
  fetchProfileById.mockResolvedValue({
    id: "user-1",
    email: "admin@example.com",
    full_name: "Admin User",
    role: "admin",
    is_approved: true,
    approved_at: null,
    deleted_at: null,
    created_at: "",
    updated_at: "",
  });
}

function mockLatestImport() {
  fetchLatestSuccessfulImport.mockResolvedValue({
    id: "import-1",
    imported_at: "2026-03-17T10:05:00.000Z",
    stock_date: "2026-03-17",
  });
  fetchInventorySummary.mockResolvedValue({
    itemCount: 4467,
    stockTotal: 42446,
  });
}

function createMatch(totalCount: number, id: string) {
  return {
    id,
    import_log_id: "import-1",
    product_code: `P-${id}`,
    product_name: `商品-${id}`,
    itf: "12345678901234",
    jan: "1234567890123",
    stock_qty: 10,
    pack_qty: 5,
    location: "A-01",
    itf_core: "1234567890123",
    created_at: "2026-03-17T00:00:00.000Z",
    stock_date: "2026-03-17",
    imported_at: "2026-03-17T10:05:00.000Z",
    match_rank: 1,
    total_count: totalCount,
  };
}

describe("search route", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    getUser.mockResolvedValue({
      data: {
        user: null,
      },
    });

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("https://example.com/api/search?q=abc"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ message: "Unauthorized" });
  });

  it("returns an invalid state for unexpected input without hitting the search query", async () => {
    mockAuthenticatedUser();

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("https://example.com/api/search?q=hello!!!"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        query: "hello!!!",
        state: "invalid",
        totalCount: 0,
        items: [],
        importSummary: null,
      }),
    );
    expect(fetchLatestSuccessfulImport).not.toHaveBeenCalled();
    expect(searchInventory).not.toHaveBeenCalled();
    expect(fetchInventorySummary).not.toHaveBeenCalled();
    expect(writeAuditLogSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.search",
        status: "failure",
        detail: expect.objectContaining({
          query: "hello!!!",
          state: "invalid",
        }),
      }),
    );
  });

  it("returns not_found when no items match", async () => {
    mockAuthenticatedUser();
    mockLatestImport();
    searchInventory.mockResolvedValue([]);

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("https://example.com/api/search?q=missing"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        query: "missing",
        state: "not_found",
        totalCount: 0,
        items: [],
        importSummary: expect.objectContaining({
          imported_at: "2026-03-17T10:05:00.000Z",
          stock_date: "2026-03-17",
          item_count: 4467,
          stock_total: 42446,
        }),
      }),
    );
    expect(writeAuditLogSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.search",
        status: "failure",
        detail: expect.objectContaining({
          query: "missing",
          state: "not_found",
          totalCount: 0,
        }),
      }),
    );
  });

  it("returns single when exactly one item matches", async () => {
    mockAuthenticatedUser();
    mockLatestImport();
    searchInventory.mockResolvedValue([createMatch(1, "item-1")]);

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("https://example.com/api/search?q=P-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        query: "P-001",
        state: "single",
        totalCount: 1,
        items: [expect.objectContaining({ id: "item-1", total_count: 1 })],
      }),
    );
    expect(writeAuditLogSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.search",
        status: "success",
        detail: expect.objectContaining({
          query: "P-001",
          state: "single",
          totalCount: 1,
        }),
      }),
    );
  });

  it("returns multiple when a few items match", async () => {
    mockAuthenticatedUser();
    mockLatestImport();
    searchInventory.mockResolvedValue([
      createMatch(3, "item-1"),
      createMatch(3, "item-2"),
      createMatch(3, "item-3"),
    ]);

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("https://example.com/api/search?q=商品"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        query: "商品",
        state: "multiple",
        totalCount: 3,
        items: [
          expect.objectContaining({ id: "item-1", total_count: 3 }),
          expect.objectContaining({ id: "item-2", total_count: 3 }),
          expect.objectContaining({ id: "item-3", total_count: 3 }),
        ],
      }),
    );
    expect(writeAuditLogSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.search",
        status: "success",
        detail: expect.objectContaining({
          query: "商品",
          state: "multiple",
          totalCount: 3,
        }),
      }),
    );
  });

  it("returns too_many and hides the item list when more than 20 items match", async () => {
    mockAuthenticatedUser();
    mockLatestImport();
    searchInventory.mockResolvedValue([
      createMatch(21, "item-1"),
      createMatch(21, "item-2"),
      createMatch(21, "item-3"),
    ]);

    const { GET } = await import("@/app/api/search/route");
    const response = await GET(new Request("https://example.com/api/search?q=1234"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json).toEqual(
      expect.objectContaining({
        query: "1234",
        state: "too_many",
        totalCount: 21,
        items: [],
      }),
    );
    expect(writeAuditLogSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.search",
        status: "success",
        detail: expect.objectContaining({
          query: "1234",
          state: "too_many",
          totalCount: 21,
        }),
      }),
    );
  });
});
