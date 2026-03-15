import { describe, it, expect, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/auth", () => ({
  auth: {
    handler: vi.fn(),
    api: { getSession: vi.fn() },
  },
}));

vi.mock("better-auth/next-js", () => ({
  toNextJsHandler: vi.fn(() => ({
    GET: vi.fn(),
    POST: vi.fn(),
  })),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET & POST /api/auth/[...all]", () => {
  it("GET handler is exported and is a function", async () => {
    const { GET } = await import("./route");
    expect(GET).toBeDefined();
    expect(typeof GET).toBe("function");
  });

  it("POST handler is exported and is a function", async () => {
    const { POST } = await import("./route");
    expect(POST).toBeDefined();
    expect(typeof POST).toBe("function");
  });
});
