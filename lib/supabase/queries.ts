import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditLog,
  ImportLog,
  ImportLogListItem,
  MemberListItem,
  Profile,
  SearchInventoryItem,
} from "@/lib/types";

export async function fetchLatestSuccessfulImport(
  supabase: SupabaseClient,
): Promise<ImportLog | null> {
  const { data, error } = await supabase
    .from("import_logs")
    .select("*")
    .eq("status", "success")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle<ImportLog>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchRecentImports(
  supabase: SupabaseClient,
  limit = 10,
): Promise<ImportLogListItem[]> {
  const { data, error } = await supabase
    .from("import_logs")
    .select("*")
    .order("imported_at", { ascending: false })
    .limit(limit)
    .returns<ImportLog[]>();

  if (error) {
    throw error;
  }

  const logs = data ?? [];
  const creatorIds = [...new Set(logs.map((log) => log.created_by).filter(Boolean))];

  if (creatorIds.length === 0) {
    return logs.map((log) => ({
      ...log,
      created_by_email: null,
      created_by_name: null,
    }));
  }

  const { data: profiles, error: profilesError } = await supabase
    .from("profiles")
    .select("id, email, full_name")
    .in("id", creatorIds);

  if (profilesError) {
    throw profilesError;
  }

  const profileById = new Map(
    (profiles ?? []).map((profile) => [profile.id, profile] as const),
  );

  return logs.map((log) => {
    const profile = log.created_by ? profileById.get(log.created_by) : null;

    return {
      ...log,
      created_by_email: profile?.email ?? null,
      created_by_name: profile?.full_name ?? null,
    };
  });
}

export async function fetchRecentAuditLogs(
  supabase: SupabaseClient,
  limit = 100,
): Promise<AuditLog[]> {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<AuditLog[]>();

  if (error) {
    if (error.code === "PGRST205") {
      return [];
    }

    throw error;
  }

  return data ?? [];
}

export async function fetchInventorySummary(
  supabase: SupabaseClient,
  importLogId: string,
): Promise<{ itemCount: number; stockTotal: number }> {
  const { data, count, error } = await supabase
    .from("inventory_items")
    .select("stock_qty", { count: "exact" })
    .eq("import_log_id", importLogId);

  if (error) {
    throw error;
  }

  const stockTotal = (data ?? []).reduce((sum, row) => {
    return sum + (row.stock_qty ?? 0);
  }, 0);

  return {
    itemCount: count ?? 0,
    stockTotal,
  };
}

export async function fetchItemById(
  supabase: SupabaseClient,
  id: string,
) {
  const { data, error } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchProfileById(
  supabase: SupabaseClient,
  userId: string,
): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle<Profile>();

  if (error) {
    throw error;
  }

  return data ?? null;
}

export async function fetchPendingProfiles(
  supabase: SupabaseClient,
  limit = 50,
): Promise<Profile[]> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("is_approved", false)
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<Profile[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export async function fetchMembers(
  supabase: SupabaseClient,
  includeDeleted = false,
): Promise<Profile[]> {
  let query = supabase
    .from("profiles")
    .select("*")
    .order("deleted_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: true });

  if (!includeDeleted) {
    query = query.is("deleted_at", null);
  }

  const { data, error } = await query.returns<Profile[]>();

  if (error) {
    throw error;
  }

  return data ?? [];
}

export function mergeMemberLastLogins(
  profiles: Profile[],
  lastLoginByUserId: Map<string, string | null>,
): MemberListItem[] {
  return profiles.map((profile) => ({
    ...profile,
    last_login_at: lastLoginByUserId.get(profile.id) ?? null,
  }));
}

export async function searchInventory(
  supabase: SupabaseClient,
  query: string,
  limit = 21,
): Promise<SearchInventoryItem[]> {
  const { data, error } = await supabase.rpc("search_inventory_items", {
    p_query: query,
    p_limit: limit,
  });

  if (error) {
    throw error;
  }

  return (data ?? []) as SearchInventoryItem[];
}
