import Link from "next/link";
import type { InventoryItem, SearchInventoryItem } from "@/lib/types";
import {
  formatBarcodeValue,
  formatLocation,
  formatPackQty,
  formatProductName,
  formatStockQty,
} from "@/lib/utils/format";
import styles from "./inventory-card.module.css";

interface InventoryCardProps {
  item: InventoryItem | SearchInventoryItem;
}

export function InventoryCard({ item }: InventoryCardProps) {
  return (
    <Link className={styles.card} href={`/items/${item.id}`}>
      <div className={styles.top}>
        <div className={styles.name}>{formatProductName(item.product_name)}</div>
        <div className={styles.stock}>{formatStockQty(item.stock_qty)}</div>
      </div>

      <div className={styles.meta}>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>バーコード</span>
          <span>{formatBarcodeValue(item)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>商品コード</span>
          <span>{item.product_code || "未登録"}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>入数</span>
          <span>{formatPackQty(item.pack_qty)}</span>
        </div>
        <div className={styles.metaRow}>
          <span className={styles.metaLabel}>ロケ</span>
          <span>{formatLocation(item.location)}</span>
        </div>
      </div>
    </Link>
  );
}
