import { type NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE_NAMES = [
  "better-auth.session_token",
  "__Secure-better-auth.session_token",
] as const;

/**
 * Lightweight session validation via internal fetch to /api/auth/get-session.
 * Returns true if the session is valid, false if invalid/expired.
 * On network or server errors, returns true (fail-open — page-level auth is the real guard).
 */
async function validateSession(request: NextRequest): Promise<boolean> {
  try {
    const origin = request.nextUrl.origin;
    const res = await fetch(`${origin}/api/auth/get-session`, {
      headers: { cookie: request.headers.get("cookie") || "" },
      signal: AbortSignal.timeout(3000),
    });

    if (!res.ok) return false;

    const data = await res.json();
    // better-auth returns { session, user } when valid, or null/empty when invalid
    return !!(data?.session && data?.user);
  } catch {
    // Network error or server down — fail-open so the page-level auth handles it
    return true;
  }
}

function clearSessionCookies(response: NextResponse): NextResponse {
  for (const name of SESSION_COOKIE_NAMES) {
    response.cookies.delete(name);
  }
  return response;
}

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

  // Validate session for protected routes when cookie exists
  if (sessionCookie && (pathname.startsWith("/dashboard") || pathname.startsWith("/onboarding"))) {
    const isValid = await validateSession(request);
    if (!isValid) {
      const url = request.nextUrl.clone();
      url.pathname = "/login";
      const response = NextResponse.redirect(url);
      return clearSessionCookies(response);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/onboarding"],
};
