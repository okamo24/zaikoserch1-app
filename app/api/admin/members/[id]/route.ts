import { NextResponse } from "next/server";
import { buildAuditActor, writeAuditLogSafe } from "@/lib/audit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchProfileById } from "@/lib/supabase/queries";
import type { UserRole } from "@/lib/types";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface MemberUpdateRequest {
  action?: "approve" | "unapprove" | "role";
  role?: UserRole;
}

async function requireAdminProfile() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, profile: null };
  }

  const profile = await fetchProfileById(supabase, user.id);
  return { user, profile };
}

async function countActiveAdmins() {
  const admin = createSupabaseAdminClient();
  const { count, error } = await admin
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("role", "admin")
    .is("deleted_at", null);

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { user, profile } = await requireAdminProfile();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const body = (await request.json()) as MemberUpdateRequest;
  const actor = buildAuditActor(user, profile);
  const admin = createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json(
      { message: "対象メンバーが見つかりません。" },
      { status: 404 },
    );
  }

  try {
    if (body.action === "approve") {
      const { error } = await admin
        .from("profiles")
        .update({
          is_approved: true,
          approved_at: new Date().toISOString(),
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      await writeAuditLogSafe({
        actor,
        action: "member.approve",
        resourceType: "member",
        resourceId: target.id,
        resourceLabel: target.email,
        status: "success",
        detail: {
          targetEmail: target.email,
        },
        request,
      });

      return NextResponse.json({ message: "メンバーを承認しました。" });
    }

    if (body.action === "unapprove") {
      const { error } = await admin
        .from("profiles")
        .update({
          is_approved: false,
          approved_at: null,
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      await writeAuditLogSafe({
        actor,
        action: "member.unapprove",
        resourceType: "member",
        resourceId: target.id,
        resourceLabel: target.email,
        status: "success",
        detail: {
          targetEmail: target.email,
        },
        request,
      });

      return NextResponse.json({ message: "承認を解除しました。" });
    }

    if (body.action === "role" && body.role) {
      if (target.id === user.id && body.role !== "admin") {
        return NextResponse.json(
          { message: "自分自身を user に変更できません。" },
          { status: 400 },
        );
      }

      if (target.role === "admin" && body.role !== "admin") {
        const adminCount = await countActiveAdmins();
        if (adminCount <= 1) {
          return NextResponse.json(
            { message: "最後の admin は変更できません。" },
            { status: 400 },
          );
        }
      }

      const { error } = await admin
        .from("profiles")
        .update({
          role: body.role,
          is_approved: body.role === "admin" ? true : target.is_approved,
          approved_at:
            body.role === "admin"
              ? target.approved_at ?? new Date().toISOString()
              : target.approved_at,
        })
        .eq("id", id);

      if (error) {
        throw error;
      }

      await writeAuditLogSafe({
        actor,
        action: "member.role_changed",
        resourceType: "member",
        resourceId: target.id,
        resourceLabel: target.email,
        status: "success",
        detail: {
          targetEmail: target.email,
          previousRole: target.role,
          nextRole: body.role,
        },
        request,
      });

      return NextResponse.json({ message: "権限を更新しました。" });
    }

    return NextResponse.json(
      { message: "不正な更新リクエストです。" },
      { status: 400 },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error
            ? error.message
            : "メンバー更新に失敗しました。",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const { user, profile } = await requireAdminProfile();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const actor = buildAuditActor(user, profile);
  const admin = createSupabaseAdminClient();
  const { data: target, error: targetError } = await admin
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (targetError || !target) {
    return NextResponse.json(
      { message: "対象メンバーが見つかりません。" },
      { status: 404 },
    );
  }

  if (target.id === user.id) {
    return NextResponse.json(
      { message: "自分自身は削除できません。" },
      { status: 400 },
    );
  }

  if (target.role === "admin") {
    const adminCount = await countActiveAdmins();
    if (adminCount <= 1) {
      return NextResponse.json(
        { message: "最後の admin は削除できません。" },
        { status: 400 },
      );
    }
  }

  const purgeRequested = new URL(request.url).searchParams.get("purge") === "1";

  if (purgeRequested) {
    if (!target.deleted_at) {
      return NextResponse.json(
        { message: "履歴削除は削除済みメンバーに対してのみ実行できます。" },
        { status: 400 },
      );
    }

    const { data: authUserResult, error: authUserError } =
      await admin.auth.admin.getUserById(id);

    if (authUserError && authUserError.status !== 404) {
      return NextResponse.json(
        { message: authUserError.message || "認証ユーザーの確認に失敗しました。" },
        { status: 500 },
      );
    }

    if (authUserResult?.user) {
      const { error: deleteAuthError } = await admin.auth.admin.deleteUser(id);

      if (deleteAuthError) {
        return NextResponse.json(
          { message: deleteAuthError.message || "認証ユーザーの削除に失敗しました。" },
          { status: 500 },
        );
      }
    } else {
      const { error: deleteProfileError } = await admin
        .from("profiles")
        .delete()
        .eq("id", id);

      if (deleteProfileError) {
        return NextResponse.json(
          { message: deleteProfileError.message || "メンバー履歴の削除に失敗しました。" },
          { status: 500 },
        );
      }
    }

    await writeAuditLogSafe({
      actor,
      action: "member.purged",
      resourceType: "member",
      resourceId: target.id,
      resourceLabel: target.email,
      status: "success",
      detail: {
        targetEmail: target.email,
      },
      request,
    });

    return NextResponse.json({ message: "削除済みメンバーの履歴を完全に削除しました。" });
  }

  const { error } = await admin
    .from("profiles")
    .update({
      deleted_at: new Date().toISOString(),
      is_approved: false,
    })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { message: error.message || "メンバー削除に失敗しました。" },
      { status: 500 },
    );
  }

  await writeAuditLogSafe({
    actor,
    action: "member.deleted",
    resourceType: "member",
    resourceId: target.id,
    resourceLabel: target.email,
    status: "success",
    detail: {
      targetEmail: target.email,
    },
    request,
  });

  return NextResponse.json({ message: "メンバーを削除しました。" });
}
