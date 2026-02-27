import { NextRequest } from "next/server";
import { middleware, config } from "@/middleware";

function createRequest(path: string, cookies?: Record<string, string>) {
  const url = new URL(path, "http://localhost:3000");
  const request = new NextRequest(url);
  if (cookies) {
    for (const [name, value] of Object.entries(cookies)) {
      request.cookies.set(name, value);
    }
  }
  return request;
}

describe("middleware", () => {
  it("redirects unauthenticated user from /dashboard to /login", async () => {
    const request = createRequest("/dashboard");
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("redirects unauthenticated user from /onboarding to /login", async () => {
    const request = createRequest("/onboarding");
    const response = await middleware(request);
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("allows authenticated user to access /dashboard with session cookie", async () => {
    const request = createRequest("/dashboard", {
      "better-auth.session_token": "valid-session",
    });
    const response = await middleware(request);
    // NextResponse.next() does not set a redirect location
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows authenticated user with __Secure- prefix cookie", async () => {
    const request = createRequest("/dashboard", {
      "__Secure-better-auth.session_token": "valid-session",
    });
    const response = await middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("returns next() for /login without cookie (no redirect loop)", async () => {
    const request = createRequest("/login");
    const response = await middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("config.matcher includes expected patterns", () => {
    expect(config.matcher).toContain("/dashboard/:path*");
    expect(config.matcher).toContain("/login");
    expect(config.matcher).toContain("/signup");
    expect(config.matcher).toContain("/onboarding");
  });
});
