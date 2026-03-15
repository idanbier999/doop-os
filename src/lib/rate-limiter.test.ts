import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { createAdminClient } from "@/lib/supabase/admin";
import { checkAndRecordRequest } from "./rate-limiter";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase.client);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("checkAndRecordRequest", () => {
  it("returns allowed=true when under the limit", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 5, error: null });

    const result = await checkAndRecordRequest("agent-001", "minute", 60);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(5);
    expect(result.maxRequests).toBe(60);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it("returns allowed=false with retryAfter when over the limit", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 61, error: null });

    const result = await checkAndRecordRequest("agent-001", "minute", 60);

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(61);
    expect(result.maxRequests).toBe(60);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("fails closed on DB error (returns allowed=false)", async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: "DB connection error" },
    });

    const result = await checkAndRecordRequest("agent-001", "minute", 60);

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(0);
    expect(result.retryAfterMs).toBe(60_000);
  });

  it("calls RPC with correct parameters", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: 1, error: null });

    await checkAndRecordRequest("agent-xyz", "hour", 1000);

    expect(mockSupabase.rpc).toHaveBeenCalledWith("increment_rate_limit", {
      p_agent_id: "agent-xyz",
      p_window_type: "hour",
      p_window_start: expect.any(String),
    });

    // Verify window_start is aligned to the hour
    const callArgs = mockSupabase.rpc.mock.calls[0][1];
    const windowStart = new Date(callArgs.p_window_start);
    expect(windowStart.getMinutes()).toBe(0);
    expect(windowStart.getSeconds()).toBe(0);
    expect(windowStart.getMilliseconds()).toBe(0);
  });
});
