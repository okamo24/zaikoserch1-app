"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ImportApiResponse } from "@/lib/types";
import styles from "./import-form.module.css";

export function ImportForm() {
  const router = useRouter();
  const [stockFile, setStockFile] = useState<File | null>(null);
  const [locationFile, setLocationFile] = useState<File | null>(null);
  const [resultText, setResultText] = useState("");
  const [isPending, startTransition] = useTransition();

  function submitImport() {
    startTransition(async () => {
      setResultText("");

      if (!stockFile || !locationFile) {
        setResultText("在庫CSVとロケCSVの両方を選択してください。");
        return;
      }

      const formData = new FormData();
      formData.append("stockFile", stockFile);
      formData.append("locationFile", locationFile);

      const response = await fetch("/api/import", {
        method: "POST",
        body: formData,
        credentials: "same-origin",
      });

      const payload = (await response.json()) as ImportApiResponse;
      setResultText(
        [
          payload.message,
          `成功件数: ${payload.successCount}`,
          `エラー件数: ${payload.errorCount}`,
          `在庫CSV件数: ${payload.stockRowCount}`,
          `ロケCSV件数: ${payload.locationRowCount}`,
        ].join("\n"),
      );

      if (payload.ok) {
        setStockFile(null);
        setLocationFile(null);
        router.refresh();
      }
    });
  }

  return (
    <section className={styles.form}>
      <div className={styles.grid}>
        <label className={styles.field}>
          <span>在庫CSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setStockFile(event.target.files?.[0] ?? null)}
          />
        </label>

        <label className={styles.field}>
          <span>ロケCSV</span>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(event) => setLocationFile(event.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      <button
        className={styles.button}
        type="button"
        onClick={submitImport}
        disabled={isPending}
      >
        {isPending ? "取込中..." : "CSVを取り込む"}
      </button>

      {resultText ? <div className={styles.result}>{resultText}</div> : null}
    </section>
  );
}
