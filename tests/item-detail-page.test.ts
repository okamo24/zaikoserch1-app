import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const headers = vi.fn(async () => new Headers({ "x-forwarded-for": "1.2.3.4" }));
const notFound = vi.fn(() => {
  throw new Error("NEXT_NOT_FOUND");
});
const requireUser = vi.fn();
const createSupabaseServerClient = vi.fn(async () => ({}));
const fetchItemById = vi.fn();
const fetchLatestSuccessfulImport = vi.fn();
const buildAuditActor = vi.fn(() => ({
  userId: "user-1",
  email: "admin@example.com",
  role: "admin",
}));
const writeAuditLogSafe = vi.fn();

vi.mock("next/headers", () => ({
  headers,
}));

vi.mock("next/navigation", () => ({
  notFound,
}));

vi.mock("@/components/app/back-button", () => ({
  BackButton: ({ fallbackHref }: { fallbackHref: string }) => `back:${fallbackHref}`,
}));

vi.mock("@/lib/auth", () => ({
  requireUser,
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient,
}));

vi.mock("@/lib/supabase/queries", () => ({
  fetchItemById,
  fetchLatestSuccessfulImport,
}));

vi.mock("@/lib/audit", () => ({
  buildAuditActor,
  writeAuditLogSafe,
}));

describe("item detail page", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    requireUser.mockResolvedValue({
      user: {
        id: "user-1",
        email: "admin@example.com",
      },
      profile: {
        id: "user-1",
        email: "admin@example.com",
        full_name: "Admin User",
        role: "admin",
        is_approved: true,
        approved_at: null,
        deleted_at: null,
        created_at: "",
        updated_at: "",
      },
    });
  });

  it("renders the item fields and writes an access audit log", async () => {
    fetchItemById.mockResolvedValue({
      id: "item-1",
      import_log_id: "import-1",
      product_code: "P-001",
      product_name: "商品A",
      itf: "12345678901234",
      jan: "1234567890123",
      stock_qty: 12,
      pack_qty: 6,
      location: "A-01",
      itf_core: "1234567890123",
      created_at: "2026-03-17T00:00:00.000Z",
    });
    fetchLatestSuccessfulImport.mockResolvedValue({
      id: "import-1",
      imported_at: "2026-03-17T10:05:00.000Z",
      stock_date: "2026-03-17",
    });

    const { default: ItemDetailPage } = await import(
      "@/app/(protected)/items/[id]/page"
    );
    const element = await ItemDetailPage({
      params: Promise.resolve({ id: "item-1" }),
    });
    const html = renderToStaticMarkup(element);

    expect(html).toContain("商品A");
    expect(html).toContain("12345678901234");
    expect(html).toContain("P-001");
    expect(html).toContain("12");
    expect(html).toContain("6");
    expect(html).toContain("A-01");
    expect(html).toContain("2026/03/17");
    expect(writeAuditLogSafe).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "inventory.item_view",
        resourceType: "inventory_item",
        resourceId: "item-1",
        resourceLabel: "P-001",
        status: "success",
        detail: expect.objectContaining({
          productCode: "P-001",
          productName: "商品A",
        }),
      }),
    );
  });

  it("calls notFound when the item does not exist", async () => {
    fetchItemById.mockResolvedValue(null);
    fetchLatestSuccessfulImport.mockResolvedValue(null);

    const { default: ItemDetailPage } = await import(
      "@/app/(protected)/items/[id]/page"
    );

    await expect(
      ItemDetailPage({
        params: Promise.resolve({ id: "missing-item" }),
      }),
    ).rejects.toThrow("NEXT_NOT_FOUND");
    expect(notFound).toHaveBeenCalledTimes(1);
    expect(writeAuditLogSafe).not.toHaveBeenCalled();
  });
});
