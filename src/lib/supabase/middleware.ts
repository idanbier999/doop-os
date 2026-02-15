import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Unauthed users trying to access protected routes -> redirect to login
  if (
    !user &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authed users on login/signup -> redirect to dashboard
  if (user && (pathname === "/login" || pathname === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  // Use RPC to check workspace membership (bypasses RLS cache issues)
  if (user && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    const { data: membership, error: membershipError } = await supabase
      .rpc("check_user_workspace_membership")
      .maybeSingle();

    if (membershipError) {
      console.error("[middleware] check_user_workspace_membership RPC failed:", membershipError.message);
    }

    // Dashboard without workspace -> onboarding
    if (pathname.startsWith("/dashboard") && !membership) {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    // Onboarding with workspace -> dashboard
    if (pathname.startsWith("/onboarding") && membership) {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
