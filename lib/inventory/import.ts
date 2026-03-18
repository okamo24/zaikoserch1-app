import { parse } from "csv-parse/sync";
import iconv from "iconv-lite";
import {
  buildItfCore,
  extractJan,
  normalizeDigits,
  normalizeNullableDigits,
  normalizeNullableText,
  normalizeText,
} from "@/lib/utils/text";

export interface ParsedInventoryRecord {
  product_code: string;
  product_name: string;
  itf: string | null;
  jan: string | null;
  stock_qty: number | null;
  pack_qty: number | null;
  location: string | null;
  itf_core: string | null;
}

interface StockRow {
  日付: string;
  商品コード: string;
  在庫数: string;
}

interface LocationRow {
  商品名: string;
  商品コード: string;
  バーコード: string;
  メモ: string;
  入数: string;
}

export interface ImportParseResult {
  stockDate: string | null;
  records: ParsedInventoryRecord[];
  stockRowCount: number;
  locationRowCount: number;
  skippedRows: number;
}

const REQUIRED_STOCK_COLUMNS = ["日付", "商品コード", "在庫数"] as const;
const REQUIRED_LOCATION_COLUMNS = [
  "商品名",
  "商品コード",
  "バーコード",
  "メモ",
  "入数",
] as const;

function decodeCsv(buffer: ArrayBuffer): string {
  const bytes = Buffer.from(buffer);
  return iconv.decode(bytes, "cp932");
}

function parseCsvRows<T>(csvText: string): T[] {
  return parse(csvText, {
    columns: true,
    bom: true,
    skip_empty_lines: true,
    trim: true,
    relax_column_count: true,
  }) as T[];
}

function assertColumns(
  row: object | undefined,
  requiredColumns: readonly string[],
  label: string,
) {
  const source = (row ?? {}) as Record<string, unknown>;
  const missing = requiredColumns.filter((column) => !(column in source));

  if (missing.length > 0) {
    throw new Error(`${label} の必須列が不足しています: ${missing.join(", ")}`);
  }
}

function parseInteger(value: string | null | undefined): number | null {
  const normalized = normalizeDigits(value);

  if (!normalized) {
    return null;
  }

  return Number.parseInt(normalized, 10);
}

function normalizeStockDate(value: string | null | undefined): string | null {
  const raw = normalizeText(value).replaceAll("/", "-");

  if (!raw) {
    return null;
  }

  const matched = raw.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);

  if (!matched) {
    return raw;
  }

  const [, year, month, day] = matched;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export async function parseInventoryFiles(
  stockFile: File,
  locationFile: File,
): Promise<ImportParseResult> {
  const stockRows = parseCsvRows<StockRow>(decodeCsv(await stockFile.arrayBuffer()));
  const locationRows = parseCsvRows<LocationRow>(
    decodeCsv(await locationFile.arrayBuffer()),
  );

  assertColumns(stockRows[0], REQUIRED_STOCK_COLUMNS, "在庫CSV");
  assertColumns(locationRows[0], REQUIRED_LOCATION_COLUMNS, "ロケCSV");

  const stockByCode = new Map<
    string,
    {
      stock_qty: number | null;
      stock_date: string | null;
    }
  >();
  const locationByCode = new Map<
    string,
    {
      product_name: string;
      itf: string | null;
      jan: string | null;
      pack_qty: number | null;
      location: string | null;
    }
  >();

  let skippedRows = 0;

  for (const row of stockRows) {
    const productCode = normalizeDigits(row.商品コード);

    if (!productCode) {
      skippedRows += 1;
      continue;
    }

      stockByCode.set(productCode, {
        stock_qty: parseInteger(row.在庫数),
        stock_date: normalizeStockDate(row.日付),
      });
  }

  for (const row of locationRows) {
    const productCode = normalizeDigits(row.商品コード);

    if (!productCode) {
      skippedRows += 1;
      continue;
    }

    const productName = normalizeText(row.商品名);
    const itf = normalizeNullableDigits(row.バーコード);
    const jan =
      extractJan(productName) ??
      (itf?.length === 13 ? normalizeNullableDigits(itf) : null);

    locationByCode.set(productCode, {
      product_name: productName,
      itf,
      jan,
      pack_qty: parseInteger(row.入数),
      location: normalizeNullableText(row.メモ),
    });
  }

  const allProductCodes = new Set([
    ...stockByCode.keys(),
    ...locationByCode.keys(),
  ]);

  const records = [...allProductCodes]
    .sort((left, right) => left.localeCompare(right, "ja-JP"))
    .map((productCode) => {
      const stock = stockByCode.get(productCode);
      const location = locationByCode.get(productCode);
      const itf = normalizeNullableDigits(location?.itf ?? null);

      return {
        product_code: productCode,
        product_name: location?.product_name ?? "",
        itf,
        jan: normalizeNullableDigits(location?.jan ?? null),
        stock_qty: stock?.stock_qty ?? null,
        pack_qty: location?.pack_qty ?? null,
        location: normalizeNullableText(location?.location ?? null),
        itf_core: buildItfCore(itf),
      };
    });

  const stockDates = stockRows
    .map((row) => normalizeStockDate(row.日付))
    .filter((value): value is string => Boolean(value));

  return {
    stockDate: stockDates[0] ?? null,
    records,
    stockRowCount: stockRows.length,
    locationRowCount: locationRows.length,
    skippedRows,
  };
}
