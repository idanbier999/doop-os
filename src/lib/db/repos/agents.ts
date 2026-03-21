import { getDb } from "@/lib/db/client";
import { agents, agentUpdates, activityLog } from "@/lib/db/schema";
import type { Agent, NewAgent } from "@/lib/db/types";
import { eq, and, lt, sql, inArray } from "drizzle-orm";

/**
 * Get all agents belonging to a workspace.
 */
export async function findByWorkspace(workspaceId: string): Promise<Agent[]> {
  const db = getDb();
  return db.select().from(agents).where(eq(agents.workspaceId, workspaceId));
}

/**
 * Get a single agent by ID.
 */
export async function findById(id: string): Promise<Agent | undefined> {
  const db = getDb();
  const rows = await db.select().from(agents).where(eq(agents.id, id)).limit(1);
  return rows[0];
}

/**
 * Lookup an agent by its API key hash (used during authentication).
 */
export async function findByApiKeyHash(hash: string): Promise<Agent | undefined> {
  const db = getDb();
  const rows = await db.select().from(agents).where(eq(agents.apiKeyHash, hash)).limit(1);
  return rows[0];
}

/**
 * Create a new agent. Returns the inserted row.
 */
export async function create(data: NewAgent): Promise<Agent> {
  const db = getDb();
  const rows = await db.insert(agents).values(data).returning();
  return rows[0];
}

/**
 * Update an agent by ID. Returns the updated row.
 */
export async function update(id: string, data: Partial<Agent>): Promise<Agent | undefined> {
  const db = getDb();
  const rows = await db
    .update(agents)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(agents.id, id))
    .returning();
  return rows[0];
}

/**
 * Update an agent's heartbeat fields and create an agent_updates entry
 * to record the heartbeat in the timeline.
 */
export async function updateHeartbeat(
  id: string,
  stage?: string,
  health?: string,
  message?: string,
  details?: object
): Promise<void> {
  const db = getDb();
  const now = new Date();

  const agentSet: Record<string, unknown> = {
    lastSeenAt: now,
    updatedAt: now,
  };
  if (stage !== undefined) agentSet.stage = stage;
  if (health !== undefined) agentSet.health = health;

  await Promise.all([
    db.update(agents).set(agentSet).where(eq(agents.id, id)),
    db.insert(agentUpdates).values({
      agentId: id,
      stage: stage ?? null,
      health: health ?? null,
      message: message ?? null,
      details: details ?? {},
      createdAt: now,
    }),
  ]);
}

/**
 * Mark agents with no heartbeat in the last 5 minutes as offline.
 * Inserts an activity_log entry for each agent transitioned to offline.
 */
export async function markStaleOffline(): Promise<number> {
  const db = getDb();
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

  // Find agents that are not already offline and haven't been seen recently
  const staleAgents = await db
    .select({ id: agents.id, workspaceId: agents.workspaceId, name: agents.name })
    .from(agents)
    .where(and(lt(agents.lastSeenAt, fiveMinutesAgo), sql`${agents.health} != 'offline'`));

  if (staleAgents.length === 0) return 0;

  // Update all stale agents to offline
  const staleIds = staleAgents.map((a) => a.id);
  await db
    .update(agents)
    .set({ health: "offline", updatedAt: new Date() })
    .where(inArray(agents.id, staleIds));

  // Insert activity log entries for each stale agent
  const logEntries = staleAgents.map((a) => ({
    workspaceId: a.workspaceId,
    agentId: a.id,
    action: "agent.went_offline",
    details: { agentName: a.name, reason: "no_heartbeat" },
  }));

  await db.insert(activityLog).values(logEntries);

  return staleAgents.length;
}
