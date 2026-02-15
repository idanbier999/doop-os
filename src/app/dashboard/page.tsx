import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { AgentPipeline } from "@/components/dashboard/agent-pipeline";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

export default async function DashboardOverviewPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const workspaceId = membership.workspace_id;

  const [agentsResult, problemsResult, tasksResult, activityResult] =
    await Promise.all([
      supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", workspaceId),
      supabase
        .from("problems")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("workspace_id", workspaceId)
        .in("status", ["pending", "in_progress"]),
      supabase
        .from("activity_log")
        .select("*, agents(name)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  const agents = agentsResult.data || [];
  const openProblemsCount = problemsResult.count ?? 0;
  const pendingTasksCount = tasksResult.count ?? 0;
  const activity = activityResult.data || [];

  const activeAgentsCount = agents.filter((a) => a.stage === "running").length;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
        Overview
      </h1>
      <StatsBar
        totalAgents={agents.length}
        activeAgents={activeAgentsCount}
        openProblems={openProblemsCount}
        pendingTasks={pendingTasksCount}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <AgentPipeline initialAgents={agents} />
        </div>
        <div>
          <ActivityFeed initialActivity={activity} agents={agents.map(a => ({ id: a.id, name: a.name }))} />
        </div>
      </div>
    </div>
  );
}
