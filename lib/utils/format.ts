import type { InventoryItem } from "@/lib/types";

const dateFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const dateTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed;
}

export function formatDate(value: string | null | undefined): string {
  const parsed = parseDate(value);
  return parsed ? dateFormatter.format(parsed) : "未設定";
}

export function formatDateTime(value: string | null | undefined): string {
  const parsed = parseDate(value);
  return parsed ? dateTimeFormatter.format(parsed) : "未設定";
}

export function formatStockQty(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "在庫データなし";
  }

  return value.toLocaleString("ja-JP");
}

export function formatPackQty(value: number | null | undefined): string {
  if (value === null || value === undefined) {
    return "未登録";
  }

  return value.toLocaleString("ja-JP");
}

export function formatLocation(value: string | null | undefined): string {
  return value?.trim() ? value : "ロケ未登録";
}

export function formatBarcodeValue(item: Pick<InventoryItem, "itf">): string {
  return item.itf?.trim() || "未登録";
}

export function formatProductName(value: string | null | undefined): string {
  return value?.trim() ? value : "商品名未登録";
}
