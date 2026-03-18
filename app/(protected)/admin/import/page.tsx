import { BackButton } from "@/components/app/back-button";
import { ImportForm } from "@/components/admin/import-form";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchLatestSuccessfulImport,
  fetchRecentImports,
} from "@/lib/supabase/queries";
import { formatDate, formatDateTime } from "@/lib/utils/format";
import styles from "./page.module.css";

export default async function AdminImportPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const latestImport = await fetchLatestSuccessfulImport(supabase);
  const recentImports = await fetchRecentImports(supabase, 10);

  return (
    <div className={styles.page}>
      <BackButton fallbackHref="/chat" />

      <section className={styles.hero}>
        <h1>CSVインポート</h1>
        <p>
          在庫CSVとロケCSVを同時に取り込みます。取込完了後、在庫検索画面のデータが更新されます。
        </p>
      </section>

      <section className={styles.card}>
        <div className={styles.stats}>
          <div className={styles.stat}>
            最終在庫基準日
            <strong>{formatDate(latestImport?.stock_date)}</strong>
          </div>
          <div className={styles.stat}>
            最終取込日時
            <strong>{formatDateTime(latestImport?.imported_at)}</strong>
          </div>
          <div className={styles.stat}>
            成功件数
            <strong>{latestImport?.success_count ?? 0}</strong>
          </div>
          <div className={styles.stat}>
            エラー件数
            <strong>{latestImport?.error_count ?? 0}</strong>
          </div>
        </div>
      </section>

      <ImportForm />

      <section className={styles.card}>
        <h2>取込履歴</h2>
        <div className={styles.logs}>
          {recentImports.map((log) => (
            <div className={styles.logRow} key={log.id}>
              <div>取込日時: {formatDateTime(log.imported_at)}</div>
              <div>
                取込者: {log.created_by_name || log.created_by_email || "不明"}
              </div>
              <div>ステータス: {log.status}</div>
              <div>在庫CSV: {log.stock_csv_filename}</div>
              <div>ロケCSV: {log.location_csv_filename}</div>
              <div>在庫CSV件数: {log.stock_csv_count}</div>
              <div>ロケCSV件数: {log.location_csv_count}</div>
              <div>
                成功件数: {log.success_count} / エラー件数: {log.error_count}
              </div>
              <div>メッセージ: {log.message || "なし"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
