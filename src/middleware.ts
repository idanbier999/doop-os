import { type NextRequest, NextResponse } from "next/server";

export async function middleware(request: NextRequest) {
  // Read session cookie directly to avoid importing heavy better-auth/cookies
  // module which hangs Turbopack compilation in Next.js 16.
  const sessionCookie =
    request.cookies.get("better-auth.session_token")?.value ||
    request.cookies.get("__Secure-better-auth.session_token")?.value;
  const pathname = request.nextUrl.pathname;

  // Unauthed users trying to access protected routes -> redirect to login
  if (!sessionCookie && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Authed users on login/signup -> redirect to dashboard
  // Note: we don't validate the session here (just check cookie existence).
  // The login/signup pages themselves handle the redirect if the session is actually valid,
  // avoiding redirect loops when the cookie is stale.

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/onboarding"],
};
