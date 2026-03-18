import Link from "next/link";
import { sanitizeNextPath } from "@/lib/utils/navigation";
import styles from "./page.module.css";

interface AuthErrorPageProps {
  searchParams: Promise<{
    message?: string;
    next?: string;
  }>;
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const params = await searchParams;
  const message = params.message ?? "認証処理でエラーが発生しました。";
  const nextPath = sanitizeNextPath(params.next);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>ログインできませんでした</h1>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Link
            className={styles.link}
            href={`/login?next=${encodeURIComponent(nextPath)}`}
          >
            ログイン画面へ戻る
          </Link>
          <Link className={styles.link} href="/">
            トップへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
