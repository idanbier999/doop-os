import { getDb } from "@/lib/db/client";
import { sql } from "drizzle-orm";

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
 * Uses an atomic INSERT ... ON CONFLICT upsert (no race conditions).
 * Fails closed on DB errors -- logs and returns allowed=false.
 */
export async function checkAndRecordRequest(
  agentId: string,
  windowType: "minute" | "hour",
  maxRequests: number
): Promise<RateLimitResult> {
  const windowMs = WINDOW_MS[windowType];
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);

  try {
    const db = getDb();

    const result = await db.execute(sql`
      INSERT INTO rate_limit_windows (agent_id, window_type, window_start, request_count)
      VALUES (${agentId}, ${windowType}, ${windowStart}, 1)
      ON CONFLICT (agent_id, window_type, window_start)
      DO UPDATE SET request_count = rate_limit_windows.request_count + 1
      RETURNING request_count
    `);

    const rows = result as unknown as { request_count: number }[];
    const currentCount = rows[0]?.request_count ?? 0;

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
