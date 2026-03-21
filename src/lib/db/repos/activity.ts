import { getDb } from "@/lib/db/client";
import { activityLog } from "@/lib/db/schema";
import type { ActivityLogEntry, NewActivityLogEntry } from "@/lib/db/types";
import { eq, and, gte, lte, desc } from "drizzle-orm";

/**
 * Insert a new activity log entry.
 */
export async function log(entry: NewActivityLogEntry): Promise<ActivityLogEntry> {
  const db = getDb();
  const rows = await db.insert(activityLog).values(entry).returning();
  return rows[0];
}

/**
 * List activity log entries for a workspace with pagination.
 */
export async function findByWorkspace(
  workspaceId: string,
  opts?: { limit?: number; offset?: number }
): Promise<ActivityLogEntry[]> {
  const db = getDb();
  const limit = opts?.limit ?? 50;
  const offset = opts?.offset ?? 0;

  return db
    .select()
    .from(activityLog)
    .where(eq(activityLog.workspaceId, workspaceId))
    .orderBy(desc(activityLog.createdAt))
    .limit(limit)
    .offset(offset);
}

/**
 * Export activity log entries for a workspace without pagination.
 * Optionally filter by date range.
 */
export async function exportByWorkspace(
  workspaceId: string,
  opts?: { startDate?: Date; endDate?: Date }
): Promise<ActivityLogEntry[]> {
  const db = getDb();

  const conditions = [eq(activityLog.workspaceId, workspaceId)];

  if (opts?.startDate) {
    conditions.push(gte(activityLog.createdAt, opts.startDate));
  }
  if (opts?.endDate) {
    conditions.push(lte(activityLog.createdAt, opts.endDate));
  }

  return db
    .select()
    .from(activityLog)
    .where(and(...conditions))
    .orderBy(desc(activityLog.createdAt));
}
