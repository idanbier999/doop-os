import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { createMockSupabaseClient, mockReject } from "@/__tests__/mocks/supabase";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAgent = {
  id: "agent-001",
  workspace_id: "ws-001",
  name: "test-agent",
};

vi.mock("@/lib/api-auth", () => ({
  authenticateAgent: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/rate-limiter", () => ({
  checkAndRecordRequest: vi.fn(),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndRecordRequest } from "@/lib/rate-limiter";
import { withRateLimit, resetQuotaCache } from "./api-rate-limit";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

const dummyHandler = vi.fn(async () => {
  return NextResponse.json({ ok: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  resetQuotaCache();
  mockSupabase = createMockSupabaseClient();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase.client);
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);

  // Default: quota lookup returns no agent-specific or workspace quota (use defaults)
  mockReject(mockSupabase.chain, { message: "not found", code: "PGRST116" });
});

function makeRequest() {
  return new NextRequest("http://localhost/api/v1/tasks", {
    method: "GET",
    headers: { Authorization: "Bearer test-key" },
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("withRateLimit", () => {
  it("returns 429 when minute limit is exceeded", async () => {
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
