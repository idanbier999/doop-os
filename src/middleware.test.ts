import { NextRequest } from "next/server";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
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

const originalFetch = global.fetch;

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  global.fetch = originalFetch;
});

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

  it("allows authenticated user to access /dashboard with valid session", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: "u1" } }),
    });

    const request = createRequest("/dashboard", {
      "doop-session": "valid-session",
    });
    const response = await middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects to /login and clears cookie when session is invalid", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(null),
    });

    const request = createRequest("/dashboard", {
      "doop-session": "stale-token",
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
    // Cookie should be cleared (set-cookie with max-age=0)
    const setCookie = response.headers.getSetCookie();
    expect(setCookie.some((c: string) => c.includes("doop-session"))).toBe(true);
  });

  it("redirects to /login when session endpoint returns non-ok status", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    });

    const request = createRequest("/dashboard", {
      "doop-session": "expired-token",
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("fails open when fetch throws (network error)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const request = createRequest("/dashboard", {
      "doop-session": "valid-session",
    });
    const response = await middleware(request);

    // Fail-open: let the request through
    expect(response.headers.get("location")).toBeNull();
  });

  it("returns next() for /login without cookie (no redirect loop)", async () => {
    const request = createRequest("/login");
    const response = await middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("forwards cookies to the session endpoint", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ user: { id: "u1" } }),
    });
    global.fetch = mockFetch;

    const request = createRequest("/dashboard", {
      "doop-session": "my-token",
    });
    await middleware(request);

    expect(mockFetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/auth/session",
      expect.objectContaining({
        headers: expect.objectContaining({ cookie: expect.stringContaining("my-token") }),
      })
    );
  });

  it("fails open when fetch times out (AbortSignal.timeout)", async () => {
    global.fetch = vi.fn().mockRejectedValue(new DOMException("Signal timed out.", "TimeoutError"));

    const request = createRequest("/dashboard", {
      "doop-session": "valid-session",
    });
    const response = await middleware(request);

    // Timeout is treated as network error -- fail-open
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects to /login when session has no user object", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ something: "else" }),
    });

    const request = createRequest("/dashboard", {
      "doop-session": "partial-token",
    });
    const response = await middleware(request);

    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/login");
  });

  it("config.matcher includes expected patterns", () => {
    expect(config.matcher).toContain("/dashboard/:path*");
    expect(config.matcher).toContain("/login");
    expect(config.matcher).toContain("/onboarding");
    // /signup is no longer in the matcher
    expect(config.matcher).not.toContain("/signup");
  });
});
