import { type NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function middleware(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);
  const pathname = request.nextUrl.pathname;

  // Unauthed users trying to access protected routes -> redirect to login
  if (
    !sessionCookie &&
    (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))
  ) {
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
