import { cache } from "react";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

const PENDING_APPROVAL_MESSAGE =
  "このアカウントは承認待ちです。管理者に承認を依頼してください。";
const DELETED_ACCOUNT_MESSAGE =
  "このアカウントは利用停止中です。管理者に連絡してください。";

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("Supabase request timed out"));
    }, ms);

    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

export const getSessionContext = cache(async () => {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error: userError,
    } = await withTimeout(supabase.auth.getUser(), 3000);

    if (userError || !user) {
      return {
        user: null,
        profile: null,
      };
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle<Profile>();

    return {
      user,
      profile: profileError ? null : (profile ?? null),
    };
  } catch {
    return {
      user: null,
      profile: null,
    };
  }
});

export function isApprovedProfile(profile: Profile | null): boolean {
  if (!profile || profile.deleted_at) {
    return false;
  }

  return profile.role === "admin" || profile.is_approved;
}

export async function requireUser() {
  const context = await getSessionContext();

  if (!context.user) {
    redirect("/login");
  }

  if (!isApprovedProfile(context.profile)) {
    const message = context.profile?.deleted_at
      ? DELETED_ACCOUNT_MESSAGE
      : PENDING_APPROVAL_MESSAGE;

    redirect(
      `/auth/error?message=${encodeURIComponent(message)}&next=${encodeURIComponent(
        "/chat",
      )}`,
    );
  }

  return context;
}

export async function requireAdmin() {
  const context = await requireUser();

  if (context.profile?.role !== "admin") {
    redirect("/chat");
  }

  return context;
}
