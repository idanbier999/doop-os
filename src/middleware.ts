import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAME = "doop-session";

/**
 * Lightweight session check via internal fetch to /api/auth/session.
 * Returns true if the session is valid, false if invalid/expired.
 * On network or server errors, returns true (fail-open — page-level auth is the real guard).
 */
async function validateSession(request: NextRequest): Promise<boolean> {
  try {
    const origin = request.nextUrl.origin;
    const res = await fetch(`${origin}/api/auth/session`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return false;

    const data = await res.json();
    return !!data?.user;
  } catch {
    // Network error or server down — fail-open so the page-level auth handles it
    return true;
  }
}

export async function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const pathname = request.nextUrl.pathname;

  // Unauthed users trying to access protected routes -> redirect to login
  if (!sessionCookie && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Validate session for protected routes when cookie exists
  if (sessionCookie && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    const isValid = await validateSession(request);
    if (!isValid) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      response.cookies.delete(SESSION_COOKIE_NAME);
      return response;
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/onboarding"],
};
