import Link from "next/link";
import styles from "./check-email-card.module.css";

interface CheckEmailCardProps {
  email?: string;
  nextPath: string;
}

function maskEmail(email: string | undefined): string {
  if (!email) {
    return "";
  }

  const [localPart, domain] = email.split("@");

  if (!localPart || !domain) {
    return email;
  }

  if (localPart.length <= 2) {
    return `${localPart[0] ?? "*"}*@${domain}`;
  }

  return `${localPart.slice(0, 2)}***@${domain}`;
}

export function CheckEmailCard({ email, nextPath }: CheckEmailCardProps) {
  const maskedEmail = maskEmail(email);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Check Mail</p>
        <h1 className={styles.title}>認証メールを送信しました</h1>
        <p className={styles.message}>
          {maskedEmail
            ? `${maskedEmail} にログインリンクを送信しました。`
            : "入力されたメールアドレスにログインリンクを送信しました。"}
        </p>
        <p className={styles.message}>
          メール内のリンクを開くとログインが完了します。見つからない場合は迷惑メールも確認してください。
        </p>

        <div className={styles.actions}>
          <Link
            className={styles.primaryLink}
            href={`/login?next=${encodeURIComponent(nextPath)}`}
          >
            戻る
          </Link>
          <Link className={styles.secondaryLink} href="/">
            トップへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}
