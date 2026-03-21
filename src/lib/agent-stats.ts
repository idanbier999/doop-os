import { getDb } from "@/lib/db/client";
import { tasks, problems, activityLog } from "@/lib/db/schema";
import { eq, and, inArray, gte, sql, desc } from "drizzle-orm";

export interface AgentStats {
  completionRate: number;
  totalTasksHandled: number;
  activeTasks: number;
  avgDurationMs: number | null;
  problemsReported: number;
  problemRate: number;
  activityCount7d: number;
  currentStreak: number;
}

export async function getAgentStats(agentId: string): Promise<AgentStats> {
  const db = getDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [allTasks, activeTasksResult, completedTasks, agentProblems, activityResult, recentTasks] =
    await Promise.all([
      // All tasks for this agent (for total count + completion rate)
      db
        .select({ id: tasks.id, status: tasks.status })
        .from(tasks)
        .where(eq(tasks.agentId, agentId)),

      // Active tasks count
      db
        .select({ count: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            eq(tasks.agentId, agentId),
            inArray(tasks.status, ["in_progress", "waiting_on_agent"])
          )
        ),

      // Completed tasks with timestamps for duration calculation
      db
        .select({ createdAt: tasks.createdAt, updatedAt: tasks.updatedAt })
        .from(tasks)
        .where(and(eq(tasks.agentId, agentId), eq(tasks.status, "completed"))),

      // All problems for this agent
      db
        .select({ id: problems.id, status: problems.status })
        .from(problems)
        .where(eq(problems.agentId, agentId)),

      // Activity in last 7 days
      db
        .select({ count: sql<number>`count(*)` })
        .from(activityLog)
        .where(and(eq(activityLog.agentId, agentId), gte(activityLog.createdAt, sevenDaysAgo))),

      // Recent tasks ordered by updated_at for streak calculation
      db
        .select({ id: tasks.id, status: tasks.status, updatedAt: tasks.updatedAt })
        .from(tasks)
        .where(and(eq(tasks.agentId, agentId), inArray(tasks.status, ["completed", "cancelled"])))
        .orderBy(desc(tasks.updatedAt))
        .limit(50),
    ]);

  const completedCount = allTasks.filter((t) => t.status === "completed").length;
  const cancelledCount = allTasks.filter((t) => t.status === "cancelled").length;
  const denominator = completedCount + cancelledCount;
  const completionRate = denominator > 0 ? Math.round((completedCount / denominator) * 100) : 0;

  // Average duration for completed tasks
  let avgDurationMs: number | null = null;
  if (completedTasks.length > 0) {
    let totalMs = 0;
    let validCount = 0;
    for (const t of completedTasks) {
      if (t.createdAt && t.updatedAt) {
        const diff = new Date(t.updatedAt).getTime() - new Date(t.createdAt).getTime();
        if (diff >= 0) {
          totalMs += diff;
          validCount++;
        }
      }
    }
    if (validCount > 0) {
      avgDurationMs = Math.round(totalMs / validCount);
    }
  }

  // Problem rate: problems per completed task
  const problemRate = completedCount > 0 ? agentProblems.length / completedCount : 0;

  // Current streak: consecutive completed tasks (most recent first) before a non-completed
  let currentStreak = 0;
  for (const t of recentTasks) {
    if (t.status === "completed") {
      currentStreak++;
    } else {
      break;
    }
  }

  return {
    completionRate,
    totalTasksHandled: allTasks.length,
    activeTasks: Number(activeTasksResult[0]?.count ?? 0),
    avgDurationMs,
    problemsReported: agentProblems.length,
    problemRate,
    activityCount7d: Number(activityResult[0]?.count ?? 0),
    currentStreak,
  };
}

export async function getAgentStatsMap(
  agentIds: string[]
): Promise<Map<string, { completionRate: number; openProblems: number }>> {
  const result = new Map<string, { completionRate: number; openProblems: number }>();

  if (agentIds.length === 0) return result;

  const db = getDb();

  const [agentTasks, openProblems] = await Promise.all([
    db
      .select({ agentId: tasks.agentId, status: tasks.status })
      .from(tasks)
      .where(
        and(inArray(tasks.agentId, agentIds), inArray(tasks.status, ["completed", "cancelled"]))
      ),

    db
      .select({ agentId: problems.agentId, status: problems.status })
      .from(problems)
      .where(and(inArray(problems.agentId, agentIds), eq(problems.status, "open"))),
  ]);

  // Group tasks by agent_id
  const tasksByAgent = new Map<string, { completed: number; cancelled: number }>();
  for (const t of agentTasks) {
    if (!t.agentId) continue;
    const entry = tasksByAgent.get(t.agentId) ?? { completed: 0, cancelled: 0 };
    if (t.status === "completed") entry.completed++;
    else if (t.status === "cancelled") entry.cancelled++;
    tasksByAgent.set(t.agentId, entry);
  }

  // Group open problems by agent_id
  const problemsByAgent = new Map<string, number>();
  for (const p of openProblems) {
    problemsByAgent.set(p.agentId, (problemsByAgent.get(p.agentId) ?? 0) + 1);
  }

  for (const id of agentIds) {
    const taskCounts = tasksByAgent.get(id);
    const denom = taskCounts ? taskCounts.completed + taskCounts.cancelled : 0;
    const completionRate = denom > 0 ? Math.round((taskCounts!.completed / denom) * 100) : 0;

    result.set(id, {
      completionRate,
      openProblems: problemsByAgent.get(id) ?? 0,
    });
  }

  return result;
}
