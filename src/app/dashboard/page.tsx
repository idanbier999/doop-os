import type { Metadata } from "next";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { redirect } from "next/navigation";

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
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const workspaceId = membership.workspace_id;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoISO = sevenDaysAgo.toISOString();

  const yesterdayEOD = new Date();
  yesterdayEOD.setDate(yesterdayEOD.getDate() - 1);
  yesterdayEOD.setHours(23, 59, 59, 999);
  const yesterdayEODISO = yesterdayEOD.toISOString();

  // First fetch workspace agent IDs for scoping problems
  const { data: wsAgents } = await supabase
    .from("agents")
    .select(
      "id, name, health, stage, agent_type, last_seen_at, workspace_id, tags, description, metadata, platform, created_at, updated_at, capabilities, webhook_url, webhook_secret, owner_id"
    )
    .eq("workspace_id", workspaceId);

  const agents = wsAgents ?? [];
  const hasAgents = agents.length > 0;
  const agentIds = agents.map((a) => a.id);

  const [
    tasksResult,
    activityResult,
    openProblemsResult,
    recentProblemsResult,
    recentTasksResult,
    activeAgentTasksResult,
    agentHealthHistoryResult,
    yesterdayProblemsResult,
    yesterdayTasksResult,
  ] = await Promise.all([
    supabase.from("tasks").select("id, status").eq("workspace_id", workspaceId),
    supabase
      .from("activity_log")
      .select("*, agents(name)")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false })
      .limit(20),
    // All open problems (not limited to 7 days) for stats bar
    agentIds.length > 0
      ? supabase.from("problems").select("severity").eq("status", "open").in("agent_id", agentIds)
      : Promise.resolve({ data: [] }),
    // Recent problems (7 days) for trend chart
    agentIds.length > 0
      ? supabase
          .from("problems")
          .select("created_at, severity")
          .in("agent_id", agentIds)
          .gte("created_at", sevenDaysAgoISO)
      : Promise.resolve({ data: [] }),
    supabase
      .from("tasks")
      .select("created_at, updated_at, status")
      .eq("workspace_id", workspaceId)
      .gte("created_at", sevenDaysAgoISO),
    // Active agent tasks — for "Working on" in agent grid
    agentIds.length > 0
      ? supabase
          .from("tasks")
          .select("agent_id, title")
          .in("agent_id", agentIds)
          .in("status", ["in_progress", "waiting_on_agent"])
      : Promise.resolve({ data: [] }),
    // Agent health history (7 days) — for sparklines in agent grid
    agentIds.length > 0
      ? supabase
          .from("agent_updates")
          .select("agent_id, health, created_at")
          .in("agent_id", agentIds)
          .gte("created_at", sevenDaysAgoISO)
      : Promise.resolve({ data: [] }),
    // Yesterday snapshot: open problems as of yesterday EOD
    agentIds.length > 0
      ? supabase
          .from("problems")
          .select("id", { count: "exact", head: true })
          .eq("status", "open")
          .in("agent_id", agentIds)
          .lte("created_at", yesterdayEODISO)
      : Promise.resolve({ count: 0 }),
    // Yesterday snapshot: tasks in-flight as of yesterday EOD
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["in_progress", "waiting_on_agent", "waiting_on_human"])
      .lte("created_at", yesterdayEODISO),
  ]);

  const tasks = tasksResult.data ?? [];
  const activity = activityResult.data ?? [];
  const openProblemsRaw = openProblemsResult.data ?? [];
  const recentProblems = recentProblemsResult.data ?? [];
  const recentTasks = recentTasksResult.data ?? [];
  const activeAgentTasks = activeAgentTasksResult.data ?? [];
  const agentHealthHistoryRaw = agentHealthHistoryResult.data ?? [];
  const yesterdayOpenProblems = (yesterdayProblemsResult as { count: number | null }).count ?? 0;
  const yesterdayTasksInFlight = (yesterdayTasksResult as { count: number | null }).count ?? 0;

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
  const tasksInFlight = tasks.filter(
    (t) =>
      t.status === "in_progress" ||
      t.status === "waiting_on_agent" ||
      t.status === "waiting_on_human"
  ).length;

  // Problem trend (7 days)
  const { keys: dateKeys, map: dateLabels } = buildDateBuckets(7);
  const problemTrend = dateKeys.map((iso) => {
    const dayProblems = recentProblems.filter(
      (p) => p.created_at && p.created_at.slice(0, 10) === iso
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
      (t) => t.created_at && t.created_at.slice(0, 10) === iso
    ).length;
    const completed = recentTasks.filter(
      (t) => t.status === "completed" && t.updated_at && t.updated_at.slice(0, 10) === iso
    ).length;
    return { date: dateLabels[iso], created, completed };
  });

  // Sparkline arrays for stats bar (7 entries each — daily new problem / task count)
  const problemsSparkline = dateKeys.map((iso) => ({
    value: recentProblems.filter((p) => p.created_at && p.created_at.slice(0, 10) === iso).length,
  }));

  const tasksSparkline = dateKeys.map((iso) => ({
    value: recentTasks.filter((t) => t.created_at && t.created_at.slice(0, 10) === iso).length,
  }));

  // Agent current task map
  const agentCurrentTask: Record<string, string> = {};
  for (const t of activeAgentTasks) {
    if (t.agent_id) agentCurrentTask[t.agent_id] = t.title;
  }

  // Agent health history map
  const agentHealthHistory: Record<
    string,
    Array<{ health: string | null; created_at: string | null }>
  > = {};
  for (const u of agentHealthHistoryRaw) {
    const aid = (u as { agent_id: string }).agent_id;
    if (!agentHealthHistory[aid]) agentHealthHistory[aid] = [];
    agentHealthHistory[aid].push({
      health: (u as { health: string | null }).health,
      created_at: (u as { created_at: string | null }).created_at,
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
