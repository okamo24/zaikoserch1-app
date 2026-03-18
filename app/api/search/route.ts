import { NextResponse } from "next/server";
import { buildAuditActor, writeAuditLogSafe } from "@/lib/audit";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchInventorySummary,
  fetchLatestSuccessfulImport,
  fetchProfileById,
  searchInventory,
} from "@/lib/supabase/queries";
import type { SearchResponse, SearchState } from "@/lib/types";
import { normalizeDigits, normalizeText } from "@/lib/utils/text";

const SEARCH_GUIDE_MESSAGE =
  "商品名、商品コード、JAN、ITF の項目で検索してください。";
const INVALID_QUERY_PATTERN = /[!@#$%^*_=[\]{};:'"\\|<>~`]/;
const ALLOWED_QUERY_PATTERN =
  /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}A-Za-z0-9０-９\s\-\/().,、。・ー]+$/u;
const CONVERSATIONAL_PATTERNS = [
  /ありますか/u,
  /あります/u,
  /あります？/u,
  /ですか/u,
  /ください/u,
  /教えて/u,
  /探して/u,
  /見つけて/u,
];

function buildMessage(state: SearchState, totalCount: number): string {
  switch (state) {
    case "empty":
      return SEARCH_GUIDE_MESSAGE;
    case "invalid":
      return SEARCH_GUIDE_MESSAGE;
    case "no_data":
      return "在庫データがまだ取り込まれていません。管理者にCSV取込を依頼してください。";
    case "not_found":
      return "該当する商品が見つかりませんでした。商品名、商品コード、JAN、ITFを確認してください。";
    case "single":
      return "1件見つかりました。";
    case "multiple":
      return `候補が${totalCount}件見つかりました。該当商品を選択してください。`;
    case "too_many":
      return "候補が多すぎます。商品名やコードを追加して絞り込んでください。";
  }
}

function isUnexpectedQuery(query: string): boolean {
  const normalized = normalizeText(query);

  if (!normalized) {
    return false;
  }

  if (normalized.length > 60) {
    return true;
  }

  if (INVALID_QUERY_PATTERN.test(normalized)) {
    return true;
  }

  if (!ALLOWED_QUERY_PATTERN.test(normalized)) {
    return true;
  }

  const digits = normalizeDigits(normalized);
  if (digits.length >= 4) {
    return false;
  }

  return CONVERSATIONAL_PATTERNS.some((pattern) => pattern.test(normalized));
}

export async function GET(request: Request) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await fetchProfileById(supabase, user.id);
  const actor = buildAuditActor(user, profile);
  const url = new URL(request.url);
  const query = url.searchParams.get("q")?.trim() ?? "";

  if (!query) {
    const emptyResponse: SearchResponse = {
      query,
      state: "empty",
      totalCount: 0,
      items: [],
      importSummary: null,
      message: buildMessage("empty", 0),
    };

    return NextResponse.json(emptyResponse);
  }

  if (isUnexpectedQuery(query)) {
    const invalidResponse: SearchResponse = {
      query,
      state: "invalid",
      totalCount: 0,
      items: [],
      importSummary: null,
      message: buildMessage("invalid", 0),
    };

    await writeAuditLogSafe({
      actor,
      action: "inventory.search",
      resourceType: "inventory",
      status: "failure",
      detail: {
        query,
        state: "invalid",
        totalCount: 0,
      },
      request,
    });

    return NextResponse.json(invalidResponse);
  }

  const latestImport = await fetchLatestSuccessfulImport(supabase);

  if (!latestImport) {
    const noDataResponse: SearchResponse = {
      query,
      state: "no_data",
      totalCount: 0,
      items: [],
      importSummary: null,
      message: buildMessage("no_data", 0),
    };

    await writeAuditLogSafe({
      actor,
      action: "inventory.search",
      resourceType: "inventory",
      status: "failure",
      detail: {
        query,
        state: "no_data",
        totalCount: 0,
      },
      request,
    });

    return NextResponse.json(noDataResponse);
  }

  const [matches, summary] = await Promise.all([
    searchInventory(supabase, query, 21),
    fetchInventorySummary(supabase, latestImport.id),
  ]);
  const totalCount = Number(matches[0]?.total_count ?? 0);
  const state: SearchState =
    totalCount === 0
      ? "not_found"
      : totalCount === 1
        ? "single"
        : totalCount > 20
          ? "too_many"
          : "multiple";

  const response: SearchResponse = {
    query,
    state,
    totalCount,
    items: state === "too_many" ? [] : matches.slice(0, 20),
    importSummary: {
      imported_at: latestImport.imported_at,
      stock_date: latestImport.stock_date,
      item_count: summary.itemCount,
      stock_total: summary.stockTotal,
    },
    message: buildMessage(state, totalCount),
  };

  await writeAuditLogSafe({
    actor,
    action: "inventory.search",
    resourceType: "inventory",
    status: state === "not_found" ? "failure" : "success",
    detail: {
      query,
      state,
      totalCount,
    },
    request,
  });

  return NextResponse.json(response);
}
