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
const parseInventoryFiles = vi.fn();
const revalidatePath = vi.fn();

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

vi.mock("@/lib/inventory/import", () => ({
  parseInventoryFiles,
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

function createImportAdminClient({
  importLogId = "import-1",
  insertError = null,
}: {
  importLogId?: string;
  insertError?: Error | null;
}) {
  const inventoryDeleteEq = vi.fn().mockResolvedValue({ error: null });
  const inventoryDelete = vi.fn(() => ({
    eq: inventoryDeleteEq,
  }));
  const inventoryInsert = vi.fn().mockResolvedValue({
    error: insertError,
  });
  const importLogUpdateEq = vi.fn().mockResolvedValue({ error: null });
  const importLogUpdate = vi.fn(() => ({
    eq: importLogUpdateEq,
  }));
  const importLogInsertSingle = vi.fn().mockResolvedValue({
    data: {
      id: importLogId,
    },
    error: null,
  });
  const importLogInsert = vi.fn(() => ({
    select: vi.fn(() => ({
      single: importLogInsertSingle,
    })),
  }));

  return {
    client: {
      from: vi.fn((table: string) => {
        if (table === "import_logs") {
          return {
            insert: importLogInsert,
            update: importLogUpdate,
          };
        }

        if (table === "inventory_items") {
          return {
            insert: inventoryInsert,
            delete: inventoryDelete,
          };
        }

        throw new Error(`Unexpected table: ${table}`);
      }),
    },
    calls: {
      importLogInsert,
      importLogInsertSingle,
      importLogUpdate,
      importLogUpdateEq,
      inventoryInsert,
      inventoryDelete,
      inventoryDeleteEq,
    },
  };
}

function createImportRequest() {
  const formData = new FormData();
  formData.set("stockFile", new File(["stock"], "stock.csv", { type: "text/csv" }));
  formData.set("locationFile", new File(["location"], "location.csv", { type: "text/csv" }));

  return new Request("https://example.com/api/import", {
    method: "POST",
    body: formData,
  });
}

describe("import route", () => {
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
  });

  it("rejects non-admin users from the CSV import API", async () => {
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

    const { POST } = await import("@/app/api/import/route");
    const response = await POST(createImportRequest());

    expect(response.status).toBe(403);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
    expect(writeAuditLogSafe).not.toHaveBeenCalled();
  });

  it("rolls back inserted rows and marks the import failed when inventory insert throws", async () => {
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
    parseInventoryFiles.mockResolvedValue({
      stockDate: "2026-03-17",
      stockRowCount: 1,
      locationRowCount: 1,
      skippedRows: 0,
      records: [
        {
          product_code: "P-001",
          product_name: "商品A",
          jan: "1234567890123",
          itf: "12345678901234",
          stock_qty: 10,
          pack_qty: 5,
          location: "A-01",
          itf_core: "1234567890123",
        },
      ],
    });
    const insertFailure = new Error("inventory insert failed");
    const adminMock = createImportAdminClient({
      insertError: insertFailure,
    });
    createSupabaseAdminClient.mockReturnValue(adminMock.client);

    const { POST } = await import("@/app/api/import/route");
    const response = await POST(createImportRequest());
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(adminMock.calls.inventoryInsert).toHaveBeenCalledTimes(1);
    expect(adminMock.calls.inventoryDelete).toHaveBeenCalledTimes(1);
    expect(adminMock.calls.inventoryDeleteEq).toHaveBeenCalledWith(
      "import_log_id",
      "import-1",
    );
    expect(adminMock.calls.importLogUpdate).toHaveBeenCalledTimes(1);
    expect(adminMock.calls.importLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "failed",
        message: "inventory insert failed",
      }),
    );
    expect(writeAuditLogSafe).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "inventory.import_started",
        status: "info",
      }),
    );
    expect(writeAuditLogSafe).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "inventory.import_failed",
        status: "failure",
        detail: expect.objectContaining({
          message: "inventory insert failed",
        }),
      }),
    );
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(json).toEqual(
      expect.objectContaining({
        ok: false,
        successCount: 0,
        errorCount: 1,
      }),
    );
  });

  it("revalidates affected pages and writes success audit logs when import succeeds", async () => {
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
    parseInventoryFiles.mockResolvedValue({
      stockDate: "2026-03-17",
      stockRowCount: 1,
      locationRowCount: 1,
      skippedRows: 0,
      records: [
        {
          product_code: "P-001",
          product_name: "商品A",
          jan: "1234567890123",
          itf: "12345678901234",
          stock_qty: 10,
          pack_qty: 5,
          location: "A-01",
          itf_core: "1234567890123",
        },
      ],
    });
    const adminMock = createImportAdminClient({});
    createSupabaseAdminClient.mockReturnValue(adminMock.client);

    const { POST } = await import("@/app/api/import/route");
    const response = await POST(createImportRequest());
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(adminMock.calls.inventoryInsert).toHaveBeenCalledTimes(1);
    expect(adminMock.calls.inventoryDelete).not.toHaveBeenCalled();
    expect(adminMock.calls.importLogUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "success",
        stock_date: "2026-03-17",
        success_count: 1,
        error_count: 0,
      }),
    );
    expect(revalidatePath).toHaveBeenCalledTimes(4);
    expect(revalidatePath).toHaveBeenNthCalledWith(1, "/chat");
    expect(revalidatePath).toHaveBeenNthCalledWith(2, "/members");
    expect(revalidatePath).toHaveBeenNthCalledWith(3, "/admin/import");
    expect(revalidatePath).toHaveBeenNthCalledWith(4, "/admin/logs");
    expect(writeAuditLogSafe).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        action: "inventory.import_started",
        status: "info",
      }),
    );
    expect(writeAuditLogSafe).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        action: "inventory.import_finished",
        status: "success",
        detail: expect.objectContaining({
          successCount: 1,
          skippedCount: 0,
        }),
      }),
    );
    expect(json).toEqual(
      expect.objectContaining({
        ok: true,
        successCount: 1,
        errorCount: 0,
        stockRowCount: 1,
        locationRowCount: 1,
      }),
    );
  });
});
