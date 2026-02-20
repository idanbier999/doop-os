import { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

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

export async function getAgentStats(
  supabase: SupabaseClient<Database>,
  agentId: string
): Promise<AgentStats> {
  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  const [
    tasksResult,
    activeTasksResult,
    completedTasksResult,
    problemsResult,
    activityResult,
    recentTasksResult,
  ] = await Promise.all([
    // All tasks for this agent (for total count + completion rate)
    supabase
      .from("tasks")
      .select("id, status")
      .eq("agent_id", agentId),

    // Active tasks count
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .in("status", ["in_progress", "waiting_on_agent"]),

    // Completed tasks with timestamps for duration calculation
    supabase
      .from("tasks")
      .select("created_at, updated_at")
      .eq("agent_id", agentId)
      .eq("status", "completed"),

    // All problems for this agent
    supabase
      .from("problems")
      .select("id, status")
      .eq("agent_id", agentId),

    // Activity in last 7 days
    supabase
      .from("activity_log")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", agentId)
      .gte("created_at", sevenDaysAgo),

    // Recent tasks ordered by updated_at for streak calculation
    supabase
      .from("tasks")
      .select("id, status, updated_at")
      .eq("agent_id", agentId)
      .in("status", ["completed", "cancelled"])
      .order("updated_at", { ascending: false })
      .limit(50),
  ]);

  const tasks = tasksResult.data ?? [];
  const completedTasks = completedTasksResult.data ?? [];
  const problems = problemsResult.data ?? [];
  const recentTasks = recentTasksResult.data ?? [];

  const completedCount = tasks.filter((t) => t.status === "completed").length;
  const cancelledCount = tasks.filter((t) => t.status === "cancelled").length;
  const denominator = completedCount + cancelledCount;
  const completionRate = denominator > 0
    ? Math.round((completedCount / denominator) * 100)
    : 0;

  // Average duration for completed tasks
  let avgDurationMs: number | null = null;
  if (completedTasks.length > 0) {
    let totalMs = 0;
    let validCount = 0;
    for (const t of completedTasks) {
      if (t.created_at && t.updated_at) {
        const diff =
          new Date(t.updated_at).getTime() - new Date(t.created_at).getTime();
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
  const problemRate =
    completedCount > 0 ? problems.length / completedCount : 0;

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
    totalTasksHandled: tasks.length,
    activeTasks: activeTasksResult.count ?? 0,
    avgDurationMs,
    problemsReported: problems.length,
    problemRate,
    activityCount7d: activityResult.count ?? 0,
    currentStreak,
  };
}

export async function getAgentStatsMap(
  supabase: SupabaseClient<Database>,
  agentIds: string[]
): Promise<Map<string, { completionRate: number; openProblems: number }>> {
  const result = new Map<
    string,
    { completionRate: number; openProblems: number }
  >();

  if (agentIds.length === 0) return result;

  const [tasksResult, problemsResult] = await Promise.all([
    supabase
      .from("tasks")
      .select("agent_id, status")
      .in("agent_id", agentIds)
      .in("status", ["completed", "cancelled"]),

    supabase
      .from("problems")
      .select("agent_id, status")
      .in("agent_id", agentIds)
      .eq("status", "open"),
  ]);

  const tasks = tasksResult.data ?? [];
  const problems = problemsResult.data ?? [];

  // Group tasks by agent_id
  const tasksByAgent = new Map<
    string,
    { completed: number; cancelled: number }
  >();
  for (const t of tasks) {
    if (!t.agent_id) continue;
    const entry = tasksByAgent.get(t.agent_id) ?? {
      completed: 0,
      cancelled: 0,
    };
    if (t.status === "completed") entry.completed++;
    else if (t.status === "cancelled") entry.cancelled++;
    tasksByAgent.set(t.agent_id, entry);
  }

  // Group open problems by agent_id
  const problemsByAgent = new Map<string, number>();
  for (const p of problems) {
    problemsByAgent.set(p.agent_id, (problemsByAgent.get(p.agent_id) ?? 0) + 1);
  }

  for (const id of agentIds) {
    const taskCounts = tasksByAgent.get(id);
    const denom = taskCounts
      ? taskCounts.completed + taskCounts.cancelled
      : 0;
    const completionRate =
      denom > 0 ? Math.round((taskCounts!.completed / denom) * 100) : 0;

    result.set(id, {
      completionRate,
      openProblems: problemsByAgent.get(id) ?? 0,
    });
  }

  return result;
}
