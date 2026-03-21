import { getDb } from "@/lib/db/client";
import { problems, agents } from "@/lib/db/schema";
import type { Problem, NewProblem } from "@/lib/db/types";
import { eq } from "drizzle-orm";

/**
 * List problems for a specific agent.
 */
export async function findByAgent(agentId: string): Promise<Problem[]> {
  const db = getDb();
  return db.select().from(problems).where(eq(problems.agentId, agentId));
}

/**
 * List problems for all agents in a workspace (joined with agents table).
 */
export async function findByWorkspace(workspaceId: string): Promise<Problem[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: problems.id,
      agentId: problems.agentId,
      severity: problems.severity,
      title: problems.title,
      description: problems.description,
      status: problems.status,
      resolvedBy: problems.resolvedBy,
      resolvedAt: problems.resolvedAt,
      createdAt: problems.createdAt,
      taskId: problems.taskId,
    })
    .from(problems)
    .innerJoin(agents, eq(problems.agentId, agents.id))
    .where(eq(agents.workspaceId, workspaceId));

  return rows;
}

/**
 * Create a new problem. Returns the inserted row.
 */
export async function create(data: NewProblem): Promise<Problem> {
  const db = getDb();
  const rows = await db.insert(problems).values(data).returning();
  return rows[0];
}

/**
 * Resolve a problem by ID.
 */
export async function resolve(id: string, resolvedBy: string): Promise<Problem | undefined> {
  const db = getDb();
  const rows = await db
    .update(problems)
    .set({
      status: "resolved",
      resolvedBy,
      resolvedAt: new Date(),
    })
    .where(eq(problems.id, id))
    .returning();
  return rows[0];
}
