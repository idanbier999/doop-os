import { getDb } from "@/lib/db/client";
import { taskComments } from "@/lib/db/schema";
import type { TaskComment, NewTaskComment } from "@/lib/db/types";
import { eq, asc } from "drizzle-orm";

/**
 * List comments for a task, ordered by creation time ascending.
 */
export async function findByTask(taskId: string): Promise<TaskComment[]> {
  const db = getDb();
  return db
    .select()
    .from(taskComments)
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));
}

/**
 * Create a new task comment. Returns the inserted row.
 */
export async function create(data: NewTaskComment): Promise<TaskComment> {
  const db = getDb();
  const rows = await db.insert(taskComments).values(data).returning();
  return rows[0];
}
