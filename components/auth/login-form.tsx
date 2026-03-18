"use client";

import { useEffect, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "./login-form.module.css";

interface LoginFormProps {
  nextPath: string;
  notice?: string | null;
  resetSession?: boolean;
}

async function clearBrowserState() {
  try {
    window.localStorage.clear();
  } catch {}

  try {
    window.sessionStorage.clear();
  } catch {}

  try {
    if ("caches" in window) {
      const keys = await window.caches.keys();
      await Promise.all(keys.map((key) => window.caches.delete(key)));
    }
  } catch {}
}

function getGoogleErrorMessage(error: Error) {
  if (error.message.includes("Unsupported provider")) {
    return "Supabase の Google 認証設定が未完了です。Provider 設定を確認してください。";
  }

  return error.message;
}

export function LoginForm({
  nextPath,
  notice,
  resetSession = false,
}: LoginFormProps) {
  const [message, setMessage] = useState(notice ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!resetSession) {
      return;
    }

    let isActive = true;

    async function resetAuthState() {
      const supabase = createSupabaseBrowserClient();
      await supabase.auth.signOut();
      await clearBrowserState();

      if (isActive) {
        window.history.replaceState({}, "", "/login");
        setMessage("ログイン状態をリセットしました。");
      }
    }

    void resetAuthState();

    return () => {
      isActive = false;
    };
  }, [resetSession]);

  async function signInWithGoogle() {
    setIsSubmitting(true);
    setMessage("");

    try {
      const supabase = createSupabaseBrowserClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(
        nextPath,
      )}`;

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo,
        },
      });

      if (error) {
        setMessage(getGoogleErrorMessage(error));
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? getGoogleErrorMessage(error)
          : "Google ログインの開始に失敗しました。",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <p className={styles.eyebrow}>Login</p>
        <h1>在庫検索にログイン</h1>
        <p className={styles.description}>
          Google アカウントでログインしてください。承認済みユーザーのみ利用できます。
        </p>
      </div>

      <div className={styles.actions}>
        <button
          className={styles.primaryButton}
          type="button"
          onClick={signInWithGoogle}
          disabled={isSubmitting}
        >
          {isSubmitting ? "移動中..." : "Googleでログイン"}
        </button>

        {message ? <p className={styles.message}>{message}</p> : null}
      </div>
    </div>
  );
}
