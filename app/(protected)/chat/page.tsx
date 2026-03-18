import { ChatClient } from "@/components/chat/chat-client";
import { requireUser } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  fetchInventorySummary,
  fetchLatestSuccessfulImport,
} from "@/lib/supabase/queries";
import styles from "./page.module.css";

export default async function ChatPage() {
  await requireUser();
  const supabase = await createSupabaseServerClient();
  const latestImport = await fetchLatestSuccessfulImport(supabase);
  const summary = latestImport
    ? await fetchInventorySummary(supabase, latestImport.id)
    : null;

  return (
    <div className={styles.page}>
      <ChatClient
        importSummary={
          latestImport
            ? {
                imported_at: latestImport.imported_at,
                stock_date: latestImport.stock_date,
                item_count: summary?.itemCount ?? 0,
                stock_total: summary?.stockTotal ?? 0,
              }
            : null
        }
      />
    </div>
  );
}
