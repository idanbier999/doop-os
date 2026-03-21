import type { Metadata } from "next";
import { requireWorkspaceMembership } from "@/lib/workspace";
import { getDb } from "@/lib/db/client";
import {
  agents as agentsTable,
  tasks as tasksTable,
  activityLog,
  problems as problemsTable,
  agentUpdates,
} from "@/lib/db/schema";
import { eq, and, inArray, gte, lte, desc, sql } from "drizzle-orm";
import type { Json } from "@/lib/database.types";

export const metadata: Metadata = { title: "Fleet | Doop" };
import { FleetStatsBar } from "@/components/fleet/fleet-stats-bar";
import { AgentHealthGrid } from "@/components/fleet/agent-health-grid";
import { ProblemTrendChart } from "@/components/fleet/problem-trend-chart";
import { TaskThroughputChart } from "@/components/fleet/task-throughput-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { WelcomeBanner } from "@/components/dashboard/welcome-banner";

function buildDateBuckets(days: number): { keys: string[]; map: Record<string, string> } {
  const keys: string[] = [];
  const map: Record<string, string> = {};
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("en-US", { weekday: "short" });
    keys.push(iso);
    map[iso] = label;
  }
  return { keys, map };
}

function isProblemTrendEmpty(
  data: Array<{ low: number; medium: number; high: number; critical: number }>
): boolean {
  return data.every((d) => d.low === 0 && d.medium === 0 && d.high === 0 && d.critical === 0);
}

export default async function DashboardOverviewPage() {
  const { workspace } = await requireWorkspaceMembership();
  const workspaceId = workspace.id;

  const db = getDb();

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const yesterdayEOD = new Date();
  yesterdayEOD.setDate(yesterdayEOD.getDate() - 1);
  yesterdayEOD.setHours(23, 59, 59, 999);

  // Fetch workspace agents
  const agents = await db
    .select()
    .from(agentsTable)
    .where(eq(agentsTable.workspaceId, workspaceId));

  const hasAgents = agents.length > 0;
  const agentIds = agents.map((a) => a.id);

  const [
    allTasks,
    activityRows,
    openProblemsRaw,
    recentProblems,
    recentTasks,
    activeAgentTasks,
    agentHealthHistoryRaw,
    yesterdayOpenProblemsResult,
    yesterdayTasksResult,
  ] = await Promise.all([
    // All tasks for status counts
    db
      .select({ id: tasksTable.id, status: tasksTable.status })
      .from(tasksTable)
      .where(eq(tasksTable.workspaceId, workspaceId)),

    // Recent activity with agent names
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        details: activityLog.details,
        createdAt: activityLog.createdAt,
        agentId: activityLog.agentId,
        userId: activityLog.userId,
        workspaceId: activityLog.workspaceId,
        agentName: agentsTable.name,
      })
      .from(activityLog)
      .leftJoin(agentsTable, eq(activityLog.agentId, agentsTable.id))
      .where(eq(activityLog.workspaceId, workspaceId))
      .orderBy(desc(activityLog.createdAt))
      .limit(20),

    // All open problems (not limited to 7 days) for stats bar
    agentIds.length > 0
      ? db
          .select({ severity: problemsTable.severity })
          .from(problemsTable)
          .where(and(eq(problemsTable.status, "open"), inArray(problemsTable.agentId, agentIds)))
      : Promise.resolve([]),

    // Recent problems (7 days) for trend chart
    agentIds.length > 0
      ? db
          .select({
            createdAt: problemsTable.createdAt,
            severity: problemsTable.severity,
          })
          .from(problemsTable)
          .where(
            and(
              inArray(problemsTable.agentId, agentIds),
              gte(problemsTable.createdAt, sevenDaysAgo)
            )
          )
      : Promise.resolve([]),

    // Recent tasks (7 days) for throughput chart
    db
      .select({
        createdAt: tasksTable.createdAt,
        updatedAt: tasksTable.updatedAt,
        status: tasksTable.status,
      })
      .from(tasksTable)
      .where(and(eq(tasksTable.workspaceId, workspaceId), gte(tasksTable.createdAt, sevenDaysAgo))),

    // Active agent tasks -- for "Working on" in agent grid
    agentIds.length > 0
      ? db
          .select({ agentId: tasksTable.agentId, title: tasksTable.title })
          .from(tasksTable)
          .where(
            and(
              inArray(tasksTable.agentId, agentIds),
              inArray(tasksTable.status, ["in_progress", "waiting_on_agent"])
            )
          )
      : Promise.resolve([]),

    // Agent health history (7 days) -- for sparklines in agent grid
    agentIds.length > 0
      ? db
          .select({
            agentId: agentUpdates.agentId,
            health: agentUpdates.health,
            createdAt: agentUpdates.createdAt,
          })
          .from(agentUpdates)
          .where(
            and(inArray(agentUpdates.agentId, agentIds), gte(agentUpdates.createdAt, sevenDaysAgo))
          )
      : Promise.resolve([]),

    // Yesterday snapshot: open problems as of yesterday EOD
    agentIds.length > 0
      ? db
          .select({ count: sql<number>`count(*)` })
          .from(problemsTable)
          .where(
            and(
              eq(problemsTable.status, "open"),
              inArray(problemsTable.agentId, agentIds),
              lte(problemsTable.createdAt, yesterdayEOD)
            )
          )
      : Promise.resolve([{ count: 0 }]),

    // Yesterday snapshot: tasks in-flight as of yesterday EOD
    db
      .select({ count: sql<number>`count(*)` })
      .from(tasksTable)
      .where(
        and(
          eq(tasksTable.workspaceId, workspaceId),
          inArray(tasksTable.status, ["in_progress", "waiting_on_agent", "waiting_on_human"]),
          lte(tasksTable.createdAt, yesterdayEOD)
        )
      ),
  ]);

  // Transform activity rows to match the expected shape (ActivityFeed uses its own snake_case type)
  const activity = activityRows.map((row) => ({
    id: row.id,
    action: row.action,
    details: (row.details ?? null) as Json | null,
    created_at: row.createdAt?.toISOString() ?? null,
    agent_id: row.agentId,
    user_id: row.userId,
    workspace_id: row.workspaceId,
    agents: row.agentName ? { name: row.agentName } : null,
  }));
  const yesterdayOpenProblems = Number(yesterdayOpenProblemsResult[0]?.count ?? 0);
  const yesterdayTasksInFlight = Number(yesterdayTasksResult[0]?.count ?? 0);

  // Agent health counts
  const agentCounts = { total: agents.length, healthy: 0, degraded: 0, critical: 0, offline: 0 };
  for (const agent of agents) {
    const h = agent.health as keyof typeof agentCounts;
    if (h in agentCounts && h !== "total") {
      agentCounts[h]++;
    }
  }

  // Open problems (all time, not just 7 days)
  const openProblemsData = {
    total: openProblemsRaw.length,
    critical: openProblemsRaw.filter((p) => p.severity === "critical").length,
  };

  // Tasks in flight
  const tasksInFlight = allTasks.filter(
    (t) =>
      t.status === "in_progress" ||
      t.status === "waiting_on_agent" ||
      t.status === "waiting_on_human"
  ).length;

  // Problem trend (7 days)
  const { keys: dateKeys, map: dateLabels } = buildDateBuckets(7);
  const problemTrend = dateKeys.map((iso) => {
    const dayProblems = recentProblems.filter(
      (p) => p.createdAt && p.createdAt.toISOString().slice(0, 10) === iso
    );
    return {
      date: dateLabels[iso],
      low: dayProblems.filter((p) => p.severity === "low").length,
      medium: dayProblems.filter((p) => p.severity === "medium").length,
      high: dayProblems.filter((p) => p.severity === "high").length,
      critical: dayProblems.filter((p) => p.severity === "critical").length,
    };
  });

  // Task throughput (7 days)
  const taskThroughput = dateKeys.map((iso) => {
    const created = recentTasks.filter(
      (t) => t.createdAt && t.createdAt.toISOString().slice(0, 10) === iso
    ).length;
    const completed = recentTasks.filter(
      (t) =>
        t.status === "completed" && t.updatedAt && t.updatedAt.toISOString().slice(0, 10) === iso
    ).length;
    return { date: dateLabels[iso], created, completed };
  });

  // Sparkline arrays for stats bar (7 entries each -- daily new problem / task count)
  const problemsSparkline = dateKeys.map((iso) => ({
    value: recentProblems.filter(
      (p) => p.createdAt && p.createdAt.toISOString().slice(0, 10) === iso
    ).length,
  }));

  const tasksSparkline = dateKeys.map((iso) => ({
    value: recentTasks.filter((t) => t.createdAt && t.createdAt.toISOString().slice(0, 10) === iso)
      .length,
  }));

  // Agent current task map
  const agentCurrentTask: Record<string, string> = {};
  for (const t of activeAgentTasks) {
    if (t.agentId) agentCurrentTask[t.agentId] = t.title;
  }

  // Agent health history map
  const agentHealthHistory: Record<
    string,
    Array<{ health: string | null; created_at: string | null }>
  > = {};
  for (const u of agentHealthHistoryRaw) {
    const aid = u.agentId;
    if (!agentHealthHistory[aid]) agentHealthHistory[aid] = [];
    agentHealthHistory[aid].push({
      health: u.health,
      created_at: u.createdAt?.toISOString() ?? null,
    });
  }

  return (
    <div className="space-y-4">
      <FleetStatsBar
        initialAgentCounts={agentCounts}
        initialOpenProblems={openProblemsData}
        initialTasksInFlight={tasksInFlight}
        problemsSparkline={problemsSparkline}
        tasksSparkline={tasksSparkline}
        yesterdayOpenProblems={yesterdayOpenProblems}
        yesterdayTasksInFlight={yesterdayTasksInFlight}
      />
      {!hasAgents && <WelcomeBanner />}
      <AgentHealthGrid
        initialAgents={agents}
        agentCurrentTask={agentCurrentTask}
        agentHealthHistory={agentHealthHistory}
      />
      <ActivityFeed
        initialActivity={activity}
        agents={agents.map((a) => ({ id: a.id, name: a.name }))}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {!isProblemTrendEmpty(problemTrend) && <ProblemTrendChart initialData={problemTrend} />}
        {hasAgents && <TaskThroughputChart initialData={taskThroughput} />}
      </div>
    </div>
  );
}
