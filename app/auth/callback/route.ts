import { NextResponse, type NextRequest } from "next/server";
import { writeAuditLogSafe } from "@/lib/audit";
import { getAllowedEmailError, isAllowedEmail } from "@/lib/auth/allowlist";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils/navigation";

const PENDING_APPROVAL_MESSAGE =
  "このアカウントは承認待ちです。管理者の承認後に利用してください。";
const DELETED_ACCOUNT_MESSAGE =
  "このアカウントは利用停止中です。管理者に連絡してください。";
const MISSING_CODE_MESSAGE =
  "認証コードが見つかりませんでした。もう一度ログインしてください。";
const LOGIN_FAILED_MESSAGE = "ログインに失敗しました。";
const PROFILE_FETCH_FAILED_MESSAGE =
  "ユーザー情報の確認に失敗しました。時間をおいて再度お試しください。";
const PROFILE_UPSERT_FAILED_MESSAGE =
  "プロフィール更新に失敗しました。時間をおいて再度お試しください。";
const PKCE_RESET_MESSAGE =
  "ログイン状態をリセットしました。もう一度 Google でログインしてください。";

function isPkceStorageError(message: string | null | undefined) {
  return Boolean(message?.includes("PKCE code verifier not found in storage"));
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = sanitizeNextPath(url.searchParams.get("next"));
  const origin = url.origin;

  if (!code) {
    await writeAuditLogSafe({
      action: "auth.access_denied",
      resourceType: "auth",
      status: "failure",
      detail: {
        reason: "missing_code",
        next,
      },
      request,
    });

    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          MISSING_CODE_MESSAGE,
        )}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.user) {
    if (isPkceStorageError(error?.message)) {
      await supabase.auth.signOut();

      return NextResponse.redirect(
        new URL(
          `/login?reset=1&message=${encodeURIComponent(
            PKCE_RESET_MESSAGE,
          )}&next=${encodeURIComponent(next)}`,
          origin,
        ),
      );
    }

    await writeAuditLogSafe({
      action: "auth.access_denied",
      resourceType: "auth",
      status: "failure",
      detail: {
        reason: "exchange_failed",
        next,
        message: error?.message ?? null,
      },
      request,
    });

    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          error?.message ?? LOGIN_FAILED_MESSAGE,
        )}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  const user = data.user;
  const email = user.email ?? "";
  const fullName =
    user.user_metadata.full_name ??
    user.user_metadata.name ??
    user.user_metadata.user_name ??
    null;

  if (!email || !isAllowedEmail(email)) {
    await writeAuditLogSafe({
      actor: {
        userId: user.id,
        email,
        name: fullName,
        role: "user",
      },
      action: "auth.access_denied",
      resourceType: "auth",
      status: "failure",
      detail: {
        reason: "allowlist_denied",
        next,
      },
      request,
    });

    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          getAllowedEmailError(),
        )}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  const admin = createSupabaseAdminClient();
  const { count: adminCount, error: adminCountError } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .is("deleted_at", null);

  const { data: existingProfile, error: profileFetchError } = await admin
    .from("profiles")
    .select("role, is_approved, approved_at, deleted_at")
    .eq("id", user.id)
    .maybeSingle<{
      role: "admin" | "user";
      is_approved: boolean;
      approved_at: string | null;
      deleted_at: string | null;
    }>();

  if (adminCountError || profileFetchError) {
    await writeAuditLogSafe({
      actor: {
        userId: user.id,
        email,
        name: fullName,
      },
      action: "auth.access_denied",
      resourceType: "auth",
      status: "failure",
      detail: {
        reason: "profile_fetch_failed",
        next,
      },
      request,
    });

    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          PROFILE_FETCH_FAILED_MESSAGE,
        )}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  const shouldBootstrapAdmin = (adminCount ?? 0) === 0;
  const isDeleted = Boolean(existingProfile?.deleted_at);
  const role =
    existingProfile?.role === "admin" || shouldBootstrapAdmin ? "admin" : "user";
  const isApproved =
    existingProfile?.is_approved === true || role === "admin" || shouldBootstrapAdmin;
  const approvedAt =
    existingProfile?.approved_at ??
    (isApproved ? new Date().toISOString() : null);

  const { error: upsertError } = await admin.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
      role,
      is_approved: isApproved,
      approved_at: approvedAt,
    },
    {
      onConflict: "id",
      ignoreDuplicates: false,
    },
  );

  if (upsertError) {
    await writeAuditLogSafe({
      actor: {
        userId: user.id,
        email,
        name: fullName,
        role,
      },
      action: "auth.access_denied",
      resourceType: "auth",
      status: "failure",
      detail: {
        reason: "profile_upsert_failed",
        next,
        message: upsertError.message,
      },
      request,
    });

    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          PROFILE_UPSERT_FAILED_MESSAGE,
        )}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  if (isDeleted) {
    await writeAuditLogSafe({
      actor: {
        userId: user.id,
        email,
        name: fullName,
        role,
      },
      action: "auth.access_denied",
      resourceType: "auth",
      status: "failure",
      detail: {
        reason: "deleted_account",
        next,
      },
      request,
    });

    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          DELETED_ACCOUNT_MESSAGE,
        )}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  if (!isApproved) {
    await writeAuditLogSafe({
      actor: {
        userId: user.id,
        email,
        name: fullName,
        role,
      },
      action: "auth.access_denied",
      resourceType: "auth",
      status: "failure",
      detail: {
        reason: "pending_approval",
        next,
      },
      request,
    });

    await supabase.auth.signOut();

    return NextResponse.redirect(
      new URL(
        `/auth/error?message=${encodeURIComponent(
          PENDING_APPROVAL_MESSAGE,
        )}&next=${encodeURIComponent(next)}`,
        origin,
      ),
    );
  }

  await writeAuditLogSafe({
    actor: {
      userId: user.id,
      email,
      name: fullName,
      role,
    },
    action: "auth.login",
    resourceType: "auth",
    status: "success",
    detail: {
      next,
      isApproved,
      bootstrappedAdmin: shouldBootstrapAdmin,
    },
    request,
  });

  return NextResponse.redirect(new URL(next, origin));
}
