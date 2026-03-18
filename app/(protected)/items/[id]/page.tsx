import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { BackButton } from "@/components/app/back-button";
import { buildAuditActor, writeAuditLogSafe } from "@/lib/audit";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchItemById,
  fetchLatestSuccessfulImport,
} from "@/lib/supabase/queries";
import {
  formatBarcodeValue,
  formatDate,
  formatDateTime,
  formatLocation,
  formatPackQty,
  formatProductName,
  formatStockQty,
} from "@/lib/utils/format";
import styles from "./page.module.css";

interface ItemDetailPageProps {
  params: Promise<{
    id: string;
  }>;
}

export default async function ItemDetailPage({ params }: ItemDetailPageProps) {
  const { user, profile } = await requireUser();
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [item, latestImport] = await Promise.all([
    fetchItemById(supabase, id),
    fetchLatestSuccessfulImport(supabase),
  ]);

  if (!item) {
    notFound();
  }

  await writeAuditLogSafe({
    actor: buildAuditActor(user, profile),
    action: "inventory.item_view",
    resourceType: "inventory_item",
    resourceId: item.id,
    resourceLabel: item.product_code,
    status: "success",
    detail: {
      productCode: item.product_code,
      productName: item.product_name,
    },
    request: await headers(),
  });

  return (
    <div className={styles.page}>
      <BackButton fallbackHref="/chat" />

      <section className={styles.card}>
        <h1 className={styles.title}>{formatProductName(item.product_name)}</h1>

        <div className={styles.grid}>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>バーコード</span>
            <div className={styles.fieldValue}>{formatBarcodeValue(item)}</div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>在庫数</span>
            <div className={styles.fieldValue}>{formatStockQty(item.stock_qty)}</div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>商品コード</span>
            <div className={styles.fieldValue}>{item.product_code || "未登録"}</div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>入数</span>
            <div className={styles.fieldValue}>{formatPackQty(item.pack_qty)}</div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>ロケ</span>
            <div className={styles.fieldValue}>{formatLocation(item.location)}</div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>在庫基準日</span>
            <div className={styles.fieldValue}>{formatDate(latestImport?.stock_date)}</div>
          </div>
          <div className={styles.field}>
            <span className={styles.fieldLabel}>最終取込日時</span>
            <div className={styles.fieldValue}>
              {formatDateTime(latestImport?.imported_at)}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
