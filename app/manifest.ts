import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "在庫検索システム",
    short_name: "在庫検索",
    description: "委託先倉庫向けの在庫確認チャットアプリ",
    start_url: "/",
    display: "standalone",
    background_color: "#f2f7fb",
    theme_color: "#2b6cb0",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/apple-icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
