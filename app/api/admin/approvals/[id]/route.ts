import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchProfileById } from "@/lib/supabase/queries";

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const profile = await fetchProfileById(supabase, user.id);

  if (profile?.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 });
  }

  const admin = createSupabaseAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ is_approved: true })
    .eq("id", id);

  if (error) {
    return NextResponse.json(
      { message: error.message || "承認に失敗しました。" },
      { status: 500 },
    );
  }

  return NextResponse.json({ message: "ユーザーを承認しました。" });
}
