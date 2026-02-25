import type { Metadata } from "next";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "Fleet | Tarely" };
import { FleetStatsBar } from "@/components/fleet/fleet-stats-bar";
import { AgentHealthGrid } from "@/components/fleet/agent-health-grid";
import { ProblemTrendChart } from "@/components/fleet/problem-trend-chart";
import { TaskThroughputChart } from "@/components/fleet/task-throughput-chart";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

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

  // First fetch workspace agent IDs for scoping problems
  const { data: wsAgents } = await supabase
    .from("agents")
    .select("id, name, health, stage, agent_type, last_seen_at, workspace_id, tags, description, metadata, platform, created_at, updated_at, capabilities, webhook_url, webhook_secret")
    .eq("workspace_id", workspaceId);

  const agents = wsAgents ?? [];
  const agentIds = agents.map((a) => a.id);

  const [tasksResult, activityResult, openProblemsResult, recentProblemsResult, recentTasksResult] =
    await Promise.all([
      supabase
        .from("tasks")
        .select("id, status")
        .eq("workspace_id", workspaceId),
      supabase
        .from("activity_log")
        .select("*, agents(name)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20),
      // All open problems (not limited to 7 days) for stats bar
      agentIds.length > 0
        ? supabase
            .from("problems")
            .select("severity")
            .eq("status", "open")
            .in("agent_id", agentIds)
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
    ]);

  const tasks = tasksResult.data ?? [];
  const activity = activityResult.data ?? [];
  const openProblemsRaw = openProblemsResult.data ?? [];
  const recentProblems = recentProblemsResult.data ?? [];
  const recentTasks = recentTasksResult.data ?? [];

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
    (t) => t.status === "in_progress" || t.status === "waiting_on_agent" || t.status === "waiting_on_human"
  ).length;

  // Problem trend (7 days) — recentProblems already scoped to workspace
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
      (t) =>
        t.status === "completed" &&
        t.updated_at &&
        t.updated_at.slice(0, 10) === iso
    ).length;
    return { date: dateLabels[iso], created, completed };
  });

  return (
    <div className="space-y-4">
      <FleetStatsBar
        initialAgentCounts={agentCounts}
        initialOpenProblems={openProblemsData}
        initialTasksInFlight={tasksInFlight}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <AgentHealthGrid initialAgents={agents} />
        </div>
        <div>
          <ActivityFeed
            initialActivity={activity}
            agents={agents.map((a) => ({ id: a.id, name: a.name }))}
          />
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ProblemTrendChart initialData={problemTrend} />
        <TaskThroughputChart initialData={taskThroughput} />
      </div>
    </div>
  );
}
