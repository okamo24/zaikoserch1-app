"use client";

import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="ja">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background:
            "radial-gradient(circle at top left, rgba(43,108,176,0.22), transparent 24%), linear-gradient(180deg, #f2f7fb 0%, #dfe9f4 100%)",
        }}
      >
        <main
          style={{
            width: "min(100%, 560px)",
            padding: 28,
            borderRadius: 28,
            border: "1px solid rgba(16,42,67,0.08)",
            background: "rgba(255,255,255,0.94)",
            boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
            lineHeight: 1.8,
          }}
        >
          <h1 style={{ marginTop: 0, color: "#102a43" }}>
            画面の読み込みに失敗しました
          </h1>
          <p style={{ color: "#486581" }}>
            再読み込みで解消しない場合は、ログイン画面から入り直してください。
          </p>
          {error?.message ? (
            <p style={{ color: "#334e68", fontSize: 14 }}>
              詳細: {error.message}
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
            <button
              type="button"
              onClick={reset}
              style={{
                minHeight: 44,
                padding: "0 16px",
                border: 0,
                borderRadius: 999,
                background: "#102a43",
                color: "#fff",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              再試行
            </button>
            <Link
              href="/login"
              style={{
                display: "inline-flex",
                alignItems: "center",
                minHeight: 44,
                padding: "0 16px",
                borderRadius: 999,
                background: "#eef5fb",
                color: "#1f4f82",
                fontWeight: 700,
                textDecoration: "none",
              }}
            >
              ログインへ
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
