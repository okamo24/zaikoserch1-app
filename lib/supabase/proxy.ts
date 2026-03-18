import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabasePublishableKey, getSupabaseUrl } from "@/lib/supabase/env";
import { buildNextPath } from "@/lib/utils/navigation";

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

function isProtectedPath(pathname: string): boolean {
  return (
    pathname.startsWith("/chat") ||
    pathname.startsWith("/items") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/members") ||
    pathname.startsWith("/settings")
  );
}

function isAdminPath(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

function redirectWithCookies(
  response: NextResponse,
  request: NextRequest,
  pathname: string,
) {
  const redirectUrl = new URL(pathname, request.url);
  const redirectResponse = NextResponse.redirect(redirectUrl);

  response.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function updateSession(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    getSupabaseUrl(),
    getSupabasePublishableKey(),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { pathname, search } = request.nextUrl;
  const nextPath = encodeURIComponent(buildNextPath(pathname, search));
  const isLoginPath = pathname === "/login";
  const resetSession = request.nextUrl.searchParams.get("reset") === "1";

  let user = null;

  try {
    const {
      data: { user: currentUser },
      error,
    } = await withTimeout(supabase.auth.getUser(), 3000);

    if (!error) {
      user = currentUser;
    }
  } catch {
    if (isProtectedPath(pathname)) {
      return redirectWithCookies(response, request, `/login?next=${nextPath}`);
    }
  }

  if (!user && isProtectedPath(pathname)) {
    return redirectWithCookies(response, request, `/login?next=${nextPath}`);
  }

  if (user) {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, is_approved, deleted_at")
        .eq("id", user.id)
        .maybeSingle<{
          role: "admin" | "user";
          is_approved: boolean;
          deleted_at: string | null;
        }>();

      const isDeleted = Boolean(profile?.deleted_at);
      const isApproved =
        !isDeleted && (profile?.role === "admin" || profile?.is_approved);

      if (isProtectedPath(pathname) && !isApproved) {
        return redirectWithCookies(
          response,
          request,
          `/auth/error?message=${encodeURIComponent(
            isDeleted ? DELETED_ACCOUNT_MESSAGE : PENDING_APPROVAL_MESSAGE,
          )}&next=${encodeURIComponent("/chat")}`,
        );
      }

      if (isLoginPath && !resetSession && isApproved) {
        const loginNextPath = request.nextUrl.searchParams.get("next") ?? "/chat";
        return redirectWithCookies(response, request, loginNextPath);
      }

      if (isAdminPath(pathname) && profile?.role !== "admin") {
        return redirectWithCookies(response, request, "/chat");
      }
    } catch {
      if (isProtectedPath(pathname)) {
        return redirectWithCookies(response, request, `/login?next=${nextPath}`);
      }
    }
  }

  return response;
}
