"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import styles from "@/app/auth/confirm/page.module.css";

interface AuthConfirmClientProps {
  nextPath: string;
}

function buildErrorRedirect(message: string) {
  return `/auth/error?message=${encodeURIComponent(message)}`;
}

function readHashParam(hash: string, key: string) {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  return params.get(key);
}

export function AuthConfirmClient({ nextPath }: AuthConfirmClientProps) {
  const router = useRouter();

  useEffect(() => {
    async function confirmLogin() {
      const hash = window.location.hash;
      const hashErrorCode = readHashParam(hash, "error_code");
      const hashErrorDescription = readHashParam(hash, "error_description");

      if (hashErrorCode === "otp_expired") {
        router.replace(
          buildErrorRedirect(
            "メールリンクの有効期限が切れました。ログイン画面から再送してください。",
          ),
        );
        return;
      }

      if (hashErrorDescription) {
        router.replace(buildErrorRedirect(hashErrorDescription));
        return;
      }

      const supabase = createSupabaseBrowserClient();
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session) {
        router.replace(
          buildErrorRedirect(
            "ログイン情報を確認できませんでした。メールリンクを再送してください。",
          ),
        );
        return;
      }

      const finalizeResponse = await fetch("/api/auth/finalize", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          next: nextPath,
        }),
      });

      const finalizeResult = (await finalizeResponse.json()) as {
        ok: boolean;
        nextPath?: string;
        message?: string;
      };

      if (!finalizeResponse.ok || !finalizeResult.ok) {
        router.replace(
          buildErrorRedirect(
            finalizeResult.message ?? "ログインの確定に失敗しました。",
          ),
        );
        return;
      }

      router.replace(finalizeResult.nextPath ?? nextPath);
    }

    void confirmLogin();
  }, [nextPath, router]);

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <p className={styles.eyebrow}>Signing In</p>
        <h1 className={styles.title}>ログインを確認しています</h1>
        <p className={styles.message}>
          メールリンクを検証しています。自動で画面が切り替わるまでお待ちください。
        </p>
      </div>
    </main>
  );
}
