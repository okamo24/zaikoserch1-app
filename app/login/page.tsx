import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionContext, isApprovedProfile } from "@/lib/auth";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { sanitizeNextPath } from "@/lib/utils/navigation";
import styles from "./page.module.css";

interface LoginPageProps {
  searchParams: Promise<{
    next?: string;
    message?: string;
    reset?: string;
  }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const nextPath = sanitizeNextPath(params.next);
  const message = params.message ?? null;
  const resetSession = params.reset === "1";

  if (!hasSupabaseEnv()) {
    return (
      <div className={styles.page}>
        <div className={styles.messageCard}>
          `.env.local` に Supabase の接続情報を設定してください。設定後にログイン画面が利用できます。
        </div>
      </div>
    );
  }

  if (resetSession) {
    return (
      <div className={styles.page}>
        <LoginForm
          nextPath={nextPath}
          notice={message}
          resetSession={resetSession}
        />
      </div>
    );
  }

  const { user, profile } = await getSessionContext();

  if (user && isApprovedProfile(profile)) {
    redirect(nextPath);
  }

  return (
    <div className={styles.page}>
      <LoginForm nextPath={nextPath} notice={message} resetSession={false} />
    </div>
  );
}
