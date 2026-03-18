import Link from "next/link";
import { sanitizeNextPath } from "@/lib/utils/navigation";
import styles from "./page.module.css";

interface AuthErrorPageProps {
  searchParams: Promise<{
    message?: string;
    next?: string;
  }>;
}

function isPkceStorageError(message: string) {
  return message.includes("PKCE code verifier not found in storage");
}

export default async function AuthErrorPage({
  searchParams,
}: AuthErrorPageProps) {
  const params = await searchParams;
  const message = params.message ?? "認証処理でエラーが発生しました。";
  const nextPath = sanitizeNextPath(params.next);
  const loginHref = isPkceStorageError(message)
    ? `/login?reset=1&next=${encodeURIComponent(nextPath)}`
    : `/login?next=${encodeURIComponent(nextPath)}`;

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>ログインできませんでした</h1>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <Link className={styles.link} href={loginHref}>
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
