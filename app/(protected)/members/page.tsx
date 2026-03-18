import { BackButton } from "@/components/app/back-button";
import { MemberList } from "@/components/members/member-list";
import { requireUser } from "@/lib/auth";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchMembers, mergeMemberLastLogins } from "@/lib/supabase/queries";
import styles from "./page.module.css";

export default async function MembersPage() {
  const { user, profile } = await requireUser();
  const isAdmin = profile?.role === "admin";
  const admin = createSupabaseAdminClient();
  const profiles = await fetchMembers(admin, isAdmin);
  const userPage = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  const lastLoginByUserId = new Map<string, string | null>();
  for (const authUser of userPage.data.users) {
    lastLoginByUserId.set(authUser.id, authUser.last_sign_in_at ?? null);
  }

  const members = mergeMemberLastLogins(profiles, lastLoginByUserId);

  return (
    <div className={styles.page}>
      <BackButton fallbackHref="/chat" />

      <section className={styles.hero}>
        <h1>メンバー</h1>
        <p>
          {isAdmin
            ? "admin は承認管理、権限変更、削除を行えます。"
            : "user はメンバー一覧のみ参照できます。"}
        </p>
      </section>

      <MemberList
        currentUserId={user.id}
        isAdmin={isAdmin}
        members={members}
      />
    </div>
  );
}
