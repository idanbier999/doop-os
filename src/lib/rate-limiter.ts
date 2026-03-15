import { createAdminClient } from "@/lib/supabase/admin";

export interface RateLimitResult {
  allowed: boolean;
  currentCount: number;
  maxRequests: number;
  retryAfterMs?: number;
}

const WINDOW_MS: Record<string, number> = {
  minute: 60_000,
  hour: 3_600_000,
};

/**
 * Check and atomically record a request against the rate limit window.
 * Uses the `increment_rate_limit` RPC for atomic upsert (no race conditions).
 * Fails closed on DB errors — logs and returns allowed=false.
 */
export async function checkAndRecordRequest(
  agentId: string,
  windowType: "minute" | "hour",
  maxRequests: number
): Promise<RateLimitResult> {
  const windowMs = WINDOW_MS[windowType];
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs).toISOString();

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.rpc("increment_rate_limit", {
      p_agent_id: agentId,
      p_window_type: windowType,
      p_window_start: windowStart,
    });

    if (error) {
      console.error("[rate-limiter] RPC error, failing closed:", error.message);
      return { allowed: false, currentCount: 0, maxRequests, retryAfterMs: 60_000 };
    }

    const currentCount = data as number;

    if (currentCount > maxRequests) {
      const windowStartMs = Math.floor(Date.now() / windowMs) * windowMs;
      const retryAfterMs = windowStartMs + windowMs - Date.now();
      return { allowed: false, currentCount, maxRequests, retryAfterMs };
    }

    return { allowed: true, currentCount, maxRequests };
  } catch (err) {
    console.error(
      "[rate-limiter] Unexpected error, failing closed:",
      err instanceof Error ? err.message : err
    );
    return { allowed: false, currentCount: 0, maxRequests, retryAfterMs: 60_000 };
  }
}
