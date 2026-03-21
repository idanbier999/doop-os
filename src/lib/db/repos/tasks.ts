import { getDb } from "@/lib/db/client";
import { tasks } from "@/lib/db/schema";
import type { Task, NewTask } from "@/lib/db/types";
import { eq, and, sql } from "drizzle-orm";

/**
 * List tasks in a workspace with optional filters.
 */
export async function findByWorkspace(
  workspaceId: string,
  filters?: { status?: string; agentId?: string; projectId?: string }
): Promise<Task[]> {
  const db = getDb();

  const conditions = [eq(tasks.workspaceId, workspaceId)];

  if (filters?.status) {
    conditions.push(eq(tasks.status, filters.status));
  }
  if (filters?.agentId) {
    conditions.push(eq(tasks.agentId, filters.agentId));
  }
  if (filters?.projectId) {
    conditions.push(eq(tasks.projectId, filters.projectId));
  }

  return db
    .select()
    .from(tasks)
    .where(and(...conditions));
}

/**
 * Get a single task by ID.
 */
export async function findById(id: string): Promise<Task | undefined> {
  const db = getDb();
  const rows = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return rows[0];
}

/**
 * Create a new task. Returns the inserted row.
 */
export async function create(data: NewTask): Promise<Task> {
  const db = getDb();
  const rows = await db.insert(tasks).values(data).returning();
  return rows[0];
}

/**
 * Update a task by ID. Returns the updated row.
 */
export async function update(id: string, data: Partial<Task>): Promise<Task | undefined> {
  const db = getDb();
  const rows = await db
    .update(tasks)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(tasks.id, id))
    .returning();
  return rows[0];
}

/**
 * Mark a task as completed, optionally storing a result payload.
 */
export async function completeTask(id: string, result?: object): Promise<Task | undefined> {
  const db = getDb();
  const rows = await db
    .update(tasks)
    .set({
      status: "completed",
      result: result ?? sql`${tasks.result}`,
      updatedAt: new Date(),
    })
    .where(eq(tasks.id, id))
    .returning();
  return rows[0];
}
