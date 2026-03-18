import Link from "next/link";

export default function NotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "min(100%, 520px)",
          padding: "28px",
          borderRadius: "28px",
          background: "rgba(255,255,255,0.94)",
          border: "1px solid rgba(16,42,67,0.08)",
          boxShadow: "0 16px 40px rgba(15,23,42,0.08)",
          lineHeight: 1.8,
        }}
      >
        <h1 style={{ color: "#102a43", marginBottom: "12px" }}>
          商品が見つかりませんでした
        </h1>
        <p style={{ color: "#486581", marginBottom: "18px" }}>
          検索結果からもう一度選び直すか、チャット画面に戻って再検索してください。
        </p>
        <Link
          href="/chat"
          style={{
            display: "inline-flex",
            minHeight: "44px",
            alignItems: "center",
            padding: "0 16px",
            borderRadius: "999px",
            background: "#102a43",
            color: "#fff",
            fontWeight: 700,
          }}
        >
          チャットへ戻る
        </Link>
      </div>
    </main>
  );
}
