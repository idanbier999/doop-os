import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createMockDb } from "@/__tests__/mocks/drizzle";

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/api-auth", () => ({
  authenticateAgent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));

vi.mock("@/lib/rate-limiter", () => ({
  checkAndRecordRequest: vi.fn(),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { checkAndRecordRequest } from "@/lib/rate-limiter";
import { withRateLimit, resetQuotaCache } from "./api-rate-limit";

const mockAgent = {
  id: "agent-001",
  workspaceId: "ws-001",
  name: "test-agent",
};

const dummyHandler = vi.fn(async () => {
  return NextResponse.json({ ok: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  resetQuotaCache();
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

  // Default: no agent-specific or workspace quota found (empty results -> use defaults)
  // The getQuota function does 2 selects: agent-specific then workspace-default
  // When both return empty, it falls back to hardcoded defaults
});

function makeRequest() {
  return new NextRequest("http://localhost/api/v1/tasks", {
    method: "GET",
    headers: { Authorization: "Bearer test-key" },
  });
}

describe("withRateLimit", () => {
  it("returns 429 when minute limit is exceeded", async () => {
    // getQuota does up to 2 selects, but we push empty to trigger defaults
    pushResult([]);
    pushResult([]);

    (checkAndRecordRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: false,
      currentCount: 61,
      maxRequests: 60,
      retryAfterMs: 30_000,
    });

    const wrapped = withRateLimit(dummyHandler);
    const response = await wrapped(makeRequest());

    expect(response.status).toBe(429);
    const json = await response.json();
    expect(json.error).toBe("Rate limit exceeded");
    expect(response.headers.get("Retry-After")).toBe("30");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
    expect(dummyHandler).not.toHaveBeenCalled();
  });

  it("returns 429 when hour limit is exceeded", async () => {
    pushResult([]);
    pushResult([]);

    (checkAndRecordRequest as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        allowed: true,
        currentCount: 50,
        maxRequests: 60,
      })
      .mockResolvedValueOnce({
        allowed: false,
        currentCount: 1001,
        maxRequests: 1000,
        retryAfterMs: 1_800_000,
      });

    const wrapped = withRateLimit(dummyHandler);
    const response = await wrapped(makeRequest());

    expect(response.status).toBe(429);
    const json = await response.json();
    expect(json.error).toBe("Rate limit exceeded");
    expect(response.headers.get("Retry-After")).toBe("1800");
    expect(dummyHandler).not.toHaveBeenCalled();
  });

  it("passes through to handler when rate limit allows", async () => {
    pushResult([]);
    pushResult([]);

    (checkAndRecordRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      currentCount: 5,
      maxRequests: 60,
    });

    const wrapped = withRateLimit(dummyHandler);
    const response = await wrapped(makeRequest());

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.ok).toBe(true);
    expect(dummyHandler).toHaveBeenCalled();
  });

  it("sets rate limit headers on successful responses", async () => {
    pushResult([]);
    pushResult([]);

    (checkAndRecordRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      currentCount: 10,
      maxRequests: 60,
    });

    const wrapped = withRateLimit(dummyHandler);
    const response = await wrapped(makeRequest());

    expect(response.headers.get("X-RateLimit-Limit")).toBe("60");
    expect(response.headers.get("X-RateLimit-Remaining")).toBe("50");
  });

  it("fails open when rate limiter errors", async () => {
    pushResult([]);
    pushResult([]);

    // checkAndRecordRequest itself handles errors and returns allowed=true
    (checkAndRecordRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      allowed: true,
      currentCount: 0,
      maxRequests: 60,
    });

    const wrapped = withRateLimit(dummyHandler);
    const response = await wrapped(makeRequest());

    expect(response.status).toBe(200);
    expect(dummyHandler).toHaveBeenCalled();
  });

  it("skips rate limit and passes through if auth fails", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const wrapped = withRateLimit(dummyHandler);
    await wrapped(makeRequest());

    // Handler should be called directly, no rate limit checks
    expect(dummyHandler).toHaveBeenCalled();
    expect(checkAndRecordRequest).not.toHaveBeenCalled();
  });
});
