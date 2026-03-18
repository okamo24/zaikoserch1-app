import { BackButton } from "@/components/app/back-button";
import { requireAdmin } from "@/lib/auth";
import { fetchRecentAuditLogs } from "@/lib/supabase/queries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { formatDateTime } from "@/lib/utils/format";
import styles from "./page.module.css";

const ACTION_LABELS: Record<string, string> = {
  "auth.login": "ログイン",
  "auth.access_denied": "アクセス拒否",
  "inventory.search": "在庫検索",
  "inventory.item_view": "商品詳細表示",
  "inventory.import_started": "CSV取込開始",
  "inventory.import_finished": "CSV取込完了",
  "inventory.import_failed": "CSV取込失敗",
  "member.approve": "メンバー承認",
  "member.unapprove": "承認解除",
  "member.role_changed": "権限変更",
  "member.deleted": "メンバー削除",
  "member.purged": "メンバー履歴削除",
};

const STATUS_LABELS: Record<string, string> = {
  info: "情報",
  success: "成功",
  failure: "失敗",
};

function formatActionLabel(action: string) {
  return ACTION_LABELS[action] ?? action;
}

function formatStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status;
}

function formatDetail(detail: Record<string, unknown>) {
  const entries = Object.entries(detail).filter(([, value]) => value !== null && value !== "");

  if (entries.length === 0) {
    return "詳細なし";
  }

  return entries
    .map(([key, value]) => `${key}: ${typeof value === "string" ? value : JSON.stringify(value)}`)
    .join(" / ");
}

export default async function AdminLogsPage() {
  await requireAdmin();
  const supabase = await createSupabaseServerClient();
  const logs = await fetchRecentAuditLogs(supabase, 100);
  const isSetupRequired = logs.length === 0;

  return (
    <div className={styles.page}>
      <BackButton fallbackHref="/chat" />

      <section className={styles.hero}>
        <h1>操作ログ</h1>
        <p>検索、商品詳細、CSV取込、メンバー操作、認証イベントの直近ログを確認できます。</p>
      </section>

      {isSetupRequired ? (
        <section className={styles.card}>
          <div className={styles.setupNotice}>
            <strong>操作ログの保存先がまだ未設定です。</strong>
            <p>
              Supabase に
              <code>supabase/migrations/202603170001_audit_logs.sql</code>
              を適用すると、ここにログが表示されます。
            </p>
          </div>
        </section>
      ) : (
        <>
          <section className={styles.card}>
            <div className={styles.summary}>
              <div className={styles.summaryItem}>
                直近表示件数
                <strong>{logs.length}</strong>
              </div>
              <div className={styles.summaryItem}>
                最新記録
                <strong>{formatDateTime(logs[0]?.created_at)}</strong>
              </div>
            </div>
          </section>

          <section className={styles.card}>
            <h2>最新100件</h2>
            <div className={styles.logs}>
              {logs.map((log) => (
                <article className={styles.logRow} key={log.id}>
                  <div className={styles.rowTop}>
                    <strong>{formatActionLabel(log.action)}</strong>
                    <span className={styles.status} data-status={log.status}>
                      {formatStatusLabel(log.status)}
                    </span>
                  </div>
                  <div>日時: {formatDateTime(log.created_at)}</div>
                  <div>実行者: {log.actor_name || log.actor_email || "不明"}</div>
                  <div>権限: {log.actor_role || "不明"}</div>
                  <div>対象: {log.resource_type}{log.resource_label ? ` / ${log.resource_label}` : ""}</div>
                  <div>識別子: {log.resource_id || "なし"}</div>
                  <div>IP: {log.ip_address || "不明"}</div>
                  <div>端末: {log.user_agent || "不明"}</div>
                  <div>詳細: {formatDetail(log.detail)}</div>
                </article>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
