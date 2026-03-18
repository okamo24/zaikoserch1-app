import { NextResponse } from "next/server";
import { writeAuditLogSafe } from "@/lib/audit";
import { getAllowedEmailError, isAllowedEmail } from "@/lib/auth/allowlist";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeNextPath } from "@/lib/utils/navigation";

interface FinalizeAuthRequest {
  next?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as FinalizeAuthRequest;
  const nextPath = sanitizeNextPath(body.next);
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "ログイン情報を確認できませんでした。メールリンクを再送してお試しください。",
      },
      { status: 401 },
    );
  }

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
        nextPath,
      },
      request,
    });

    await supabase.auth.signOut();

    return NextResponse.json(
      {
        ok: false,
        message: getAllowedEmailError(),
      },
      { status: 403 },
    );
  }

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email,
      full_name: fullName,
    },
    {
      onConflict: "id",
      ignoreDuplicates: false,
    },
  );

  if (profileError) {
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
        reason: "finalize_profile_upsert_failed",
        nextPath,
        message: profileError.message,
      },
      request,
    });

    return NextResponse.json(
      {
        ok: false,
        message:
          "プロフィール更新に失敗しました。時間をおいて再度お試しください。",
      },
      { status: 500 },
    );
  }

  await writeAuditLogSafe({
    actor: {
      userId: user.id,
      email,
      name: fullName,
      role: "user",
    },
    action: "auth.login",
    resourceType: "auth",
    status: "info",
    detail: {
      reason: "finalize_completed",
      nextPath,
    },
    request,
  });

  return NextResponse.json({
    ok: true,
    nextPath,
  });
}
