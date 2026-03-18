import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { buildAuditActor, writeAuditLogSafe } from "@/lib/audit";
import { parseInventoryFiles } from "@/lib/inventory/import";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchProfileById } from "@/lib/supabase/queries";
import type { ImportApiResponse } from "@/lib/types";

const CHUNK_SIZE = 500;

function chunkRecords<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await fetchProfileById(supabase, user.id);
  const actor = buildAuditActor(user, profile);

  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const stockFile = formData.get("stockFile");
  const locationFile = formData.get("locationFile");

  if (!(stockFile instanceof File) || !(locationFile instanceof File)) {
    const invalidResponse: ImportApiResponse = {
      ok: false,
      message: "在庫CSVとロケCSVの両方を選択してください。",
      successCount: 0,
      errorCount: 0,
      stockRowCount: 0,
      locationRowCount: 0,
    };

    return NextResponse.json(invalidResponse, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const importedAt = new Date().toISOString();
  const { data: importLog, error: importLogError } = await admin
    .from("import_logs")
    .insert({
      imported_at: importedAt,
      stock_csv_filename: stockFile.name,
      location_csv_filename: locationFile.name,
      created_by: user.id,
      status: "running",
      message: "CSV取込を開始しました。",
    })
    .select("*")
    .single();

  if (importLogError || !importLog) {
    return NextResponse.json(
      {
        ok: false,
        message: importLogError?.message ?? "取込ログの作成に失敗しました。",
        successCount: 0,
        errorCount: 0,
        stockRowCount: 0,
        locationRowCount: 0,
      } satisfies ImportApiResponse,
      { status: 500 },
    );
  }

  await writeAuditLogSafe({
    actor,
    action: "inventory.import_started",
    resourceType: "import",
    resourceId: importLog.id,
    resourceLabel: stockFile.name,
    status: "info",
    detail: {
      stockFileName: stockFile.name,
      locationFileName: locationFile.name,
    },
    request,
  });

  try {
    const parsed = await parseInventoryFiles(stockFile, locationFile);

    if (parsed.records.length === 0) {
      throw new Error("取込対象データがありません。CSVの内容を確認してください。");
    }

    const rows = parsed.records.map((record) => ({
      import_log_id: importLog.id,
      ...record,
    }));

    for (const chunk of chunkRecords(rows, CHUNK_SIZE)) {
      const { error } = await admin.from("inventory_items").insert(chunk);

      if (error) {
        throw error;
      }
    }

    const { error: updateError } = await admin
      .from("import_logs")
      .update({
        status: "success",
        stock_date: parsed.stockDate,
        stock_csv_count: parsed.stockRowCount,
        location_csv_count: parsed.locationRowCount,
        success_count: rows.length,
        error_count: parsed.skippedRows,
        message: "CSV取込が完了しました。",
      })
      .eq("id", importLog.id);

    if (updateError) {
      throw updateError;
    }

    revalidatePath("/chat");
    revalidatePath("/members");
    revalidatePath("/admin/import");
    revalidatePath("/admin/logs");

    await writeAuditLogSafe({
      actor,
      action: "inventory.import_finished",
      resourceType: "import",
      resourceId: importLog.id,
      resourceLabel: stockFile.name,
      status: "success",
      detail: {
        stockFileName: stockFile.name,
        locationFileName: locationFile.name,
        stockRowCount: parsed.stockRowCount,
        locationRowCount: parsed.locationRowCount,
        successCount: rows.length,
        skippedCount: parsed.skippedRows,
      },
      request,
    });

    return NextResponse.json({
      ok: true,
      message: "CSV取込が完了しました。",
      successCount: rows.length,
      errorCount: parsed.skippedRows,
      stockRowCount: parsed.stockRowCount,
      locationRowCount: parsed.locationRowCount,
    } satisfies ImportApiResponse);
  } catch (error) {
    await admin.from("inventory_items").delete().eq("import_log_id", importLog.id);
    await admin
      .from("import_logs")
      .update({
        status: "failed",
        message:
          error instanceof Error ? error.message : "CSV取込に失敗しました。",
      })
      .eq("id", importLog.id);

    await writeAuditLogSafe({
      actor,
      action: "inventory.import_failed",
      resourceType: "import",
      resourceId: importLog.id,
      resourceLabel: stockFile.name,
      status: "failure",
      detail: {
        stockFileName: stockFile.name,
        locationFileName: locationFile.name,
        message: error instanceof Error ? error.message : "unknown_error",
      },
      request,
    });

    return NextResponse.json(
      {
        ok: false,
        message:
          error instanceof Error ? error.message : "CSV取込に失敗しました。",
        successCount: 0,
        errorCount: 1,
        stockRowCount: 0,
        locationRowCount: 0,
      } satisfies ImportApiResponse,
      { status: 500 },
    );
  }
}
