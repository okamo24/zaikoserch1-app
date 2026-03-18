import { BackButton } from "@/components/app/back-button";
import { requireUser } from "@/lib/auth";
import styles from "./page.module.css";

export default async function SettingsPage() {
  const { user } = await requireUser();

  return (
    <div className={styles.page}>
      <BackButton fallbackHref="/chat" />

      <section className={styles.hero}>
        <h1>設定</h1>
        <p>現時点では最小限の設定項目のみ提供します。</p>
      </section>

      <section className={styles.card}>
        <h2>アカウント</h2>
        <p>{user.email ?? "未取得"}</p>
      </section>

      <section className={styles.card}>
        <h2>テーマ色</h2>
        <p>開発中</p>
      </section>

      <section className={styles.card}>
        <h2>問合せフォーム</h2>
        <p>開発中</p>
      </section>
    </div>
  );
}
