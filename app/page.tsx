import Link from "next/link";
import { getSessionContext } from "@/lib/auth";
import { hasSupabaseEnv, missingSupabaseEnv } from "@/lib/supabase/env";
import styles from "./page.module.css";

export default async function Home() {
  const isSupabaseReady = hasSupabaseEnv();
  const missingEnv = missingSupabaseEnv();
  const { user } = isSupabaseReady ? await getSessionContext() : { user: null };

  return (
    <div className={styles.page}>
      <main className={styles.main}>
        <section className={styles.hero}>
          <p className={styles.eyebrow}>Environment Setup</p>
          <h1>クラプロ在庫確認アプリ</h1>
          <p className={styles.lead}>
            Next.js + Vercel + Supabase を前提にした新しい実装基盤です。
            ここから認証、CSV取込、検索UIを順に積み上げます。
          </p>
          <div className={styles.actions}>
            <Link className={styles.primaryAction} href={user ? "/chat" : "/login"}>
              {user ? "アプリを開く" : "ログインへ進む"}
            </Link>
            <Link className={styles.secondaryAction} href="/admin/import">
              管理画面
            </Link>
          </div>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>今回の構成</h2>
            <span>v0.1</span>
          </div>
          <ul className={styles.stackList}>
            <li>Frontend: Next.js App Router</li>
            <li>Hosting: Vercel</li>
            <li>Database/Auth: Supabase</li>
            <li>PWA: manifest + icon baseline</li>
          </ul>
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Supabase 接続状態</h2>
            <span className={isSupabaseReady ? styles.ready : styles.pending}>
              {isSupabaseReady ? "Connected" : "Pending"}
            </span>
          </div>
          {isSupabaseReady ? (
            <p className={styles.statusText}>
              環境変数は揃っています。次は認証画面と保護ルートの実装に進めます。
            </p>
          ) : (
            <>
              <p className={styles.statusText}>
                `.env.local` に次の値を設定すると、Supabase 連携を有効化できます。
              </p>
              <ul className={styles.stackList}>
                {missingEnv.map((key) => (
                  <li key={key}>
                    <code>{key}</code>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>次の着手順</h2>
            <span>Ready</span>
          </div>
          <ol className={styles.taskList}>
            <li>Supabase プロジェクト作成と環境変数設定</li>
            <li>認証画面と保護ルートの追加</li>
            <li>CSV取込用テーブル作成</li>
            <li>管理画面と検索APIの実装</li>
          </ol>
        </section>
      </main>
    </div>
  );
}
