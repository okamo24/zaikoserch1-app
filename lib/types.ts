export type UserRole = "admin" | "user";

export type ImportStatus = "running" | "success" | "failed";
export type AuditLogStatus = "info" | "success" | "failure";

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_approved: boolean;
  approved_at: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MemberListItem extends Profile {
  last_login_at: string | null;
}

export interface ImportLog {
  id: string;
  imported_at: string;
  stock_date: string | null;
  stock_csv_filename: string;
  location_csv_filename: string;
  stock_csv_count: number;
  location_csv_count: number;
  success_count: number;
  error_count: number;
  status: ImportStatus;
  message: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportLogListItem extends ImportLog {
  created_by_email: string | null;
  created_by_name: string | null;
}

export interface AuditLog {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  actor_name: string | null;
  actor_role: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  resource_label: string | null;
  status: AuditLogStatus;
  detail: Record<string, unknown>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface InventoryItem {
  id: string;
  import_log_id: string;
  product_code: string;
  product_name: string;
  itf: string | null;
  jan: string | null;
  stock_qty: number | null;
  pack_qty: number | null;
  location: string | null;
  itf_core: string | null;
  created_at: string;
}

export interface SearchInventoryItem extends InventoryItem {
  stock_date: string | null;
  imported_at: string | null;
  match_rank: number;
  total_count: number;
}

export interface ImportSummary {
  imported_at: string | null;
  stock_date: string | null;
  item_count: number;
  stock_total: number;
}

export type SearchState =
  | "empty"
  | "invalid"
  | "no_data"
  | "not_found"
  | "single"
  | "multiple"
  | "too_many";

export interface SearchResponse {
  query: string;
  state: SearchState;
  totalCount: number;
  items: SearchInventoryItem[];
  importSummary: ImportSummary | null;
  message: string;
}

export interface ImportApiResponse {
  ok: boolean;
  message: string;
  successCount: number;
  errorCount: number;
  stockRowCount: number;
  locationRowCount: number;
}
