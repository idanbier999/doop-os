import { getDb } from "@/lib/db/client";
import { sql } from "drizzle-orm";

/**
 * Atomic UPSERT that increments a rate-limit window's request_count and
 * returns the new count. Uses ON CONFLICT to guarantee atomicity.
 */
export async function incrementAndCheck(
  agentId: string,
  windowType: string,
  windowStart: Date
): Promise<number> {
  const db = getDb();

  const result = await db.execute(sql`
    INSERT INTO rate_limit_windows (agent_id, window_type, window_start, request_count)
    VALUES (${agentId}, ${windowType}, ${windowStart}, 1)
    ON CONFLICT (agent_id, window_type, window_start)
    DO UPDATE SET request_count = rate_limit_windows.request_count + 1
    RETURNING request_count
  `);

  // drizzle db.execute returns rows; extract the count from the first row
  const rows = result as unknown as { request_count: number }[];
  return rows[0]?.request_count ?? 0;
}
