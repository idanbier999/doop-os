import { getDb } from "@/lib/db/client";
import { projects, projectAgents, tasks } from "@/lib/db/schema";
import type { Project, NewProject } from "@/lib/db/types";
import { eq, sql } from "drizzle-orm";

/**
 * List projects in a workspace.
 */
export async function findByWorkspace(workspaceId: string): Promise<Project[]> {
  const db = getDb();
  return db.select().from(projects).where(eq(projects.workspaceId, workspaceId));
}

/**
 * Get a single project by ID.
 */
export async function findById(id: string): Promise<Project | undefined> {
  const db = getDb();
  const rows = await db.select().from(projects).where(eq(projects.id, id)).limit(1);
  return rows[0];
}

/**
 * Create a new project. Returns the inserted row.
 */
export async function create(data: NewProject): Promise<Project> {
  const db = getDb();
  const rows = await db.insert(projects).values(data).returning();
  return rows[0];
}

/**
 * Update a project by ID. Returns the updated row.
 */
export async function update(id: string, data: Partial<Project>): Promise<Project | undefined> {
  const db = getDb();
  const rows = await db
    .update(projects)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(projects.id, id))
    .returning();
  return rows[0];
}

/**
 * Recalculate project status based on the statuses of its tasks.
 * - All tasks completed -> "completed"
 * - Any task in_progress -> "in_progress"
 * - Otherwise -> "draft"
 */
export async function recalculateStatus(projectId: string): Promise<Project | undefined> {
  const db = getDb();

  const statusCounts = await db
    .select({
      status: tasks.status,
      count: sql<number>`count(*)`.as("count"),
    })
    .from(tasks)
    .where(eq(tasks.projectId, projectId))
    .groupBy(tasks.status);

  let totalCount = 0;
  let completedCount = 0;
  let inProgressCount = 0;

  for (const row of statusCounts) {
    const c = Number(row.count);
    totalCount += c;
    if (row.status === "completed") completedCount += c;
    if (row.status === "in_progress") inProgressCount += c;
  }

  let newStatus: string;
  if (totalCount > 0 && completedCount === totalCount) {
    newStatus = "completed";
  } else if (inProgressCount > 0) {
    newStatus = "in_progress";
  } else {
    newStatus = "draft";
  }

  const rows = await db
    .update(projects)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(projects.id, projectId))
    .returning();

  return rows[0];
}

/**
 * Add an agent to a project.
 */
export async function addAgent(projectId: string, agentId: string, role?: string): Promise<void> {
  const db = getDb();
  await db.insert(projectAgents).values({
    projectId,
    agentId,
    role: role ?? "member",
  });
}
