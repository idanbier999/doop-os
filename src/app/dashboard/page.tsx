import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { StatsBar } from "@/components/dashboard/stats-bar";
import { OverviewClient } from "@/components/dashboard/overview-client";
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

  const [boardsResult, tasksResult, problemsResult, activityResult, agentsResult] =
    await Promise.all([
      supabase
        .from("boards")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("position"),
      supabase
        .from("tasks")
        .select("id, board_id, status, agent_id")
        .eq("workspace_id", workspaceId),
      supabase
        .from("problems")
        .select("*", { count: "exact", head: true })
        .eq("status", "open"),
      supabase
        .from("activity_log")
        .select("*, agents(name)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false })
        .limit(20),
      supabase
        .from("agents")
        .select("id, name")
        .eq("workspace_id", workspaceId),
    ]);

  const boards = boardsResult.data || [];
  const tasks = tasksResult.data || [];
  const openProblemsCount = problemsResult.count ?? 0;
  const activity = activityResult.data || [];
  const agents = agentsResult.data || [];

  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length;

  return (
    <div className="space-y-4">
      <StatsBar
        totalBoards={boards.length}
        totalTasks={tasks.length}
        inProgress={inProgressCount}
        openProblems={openProblemsCount}
      />
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <OverviewClient initialBoards={boards} initialTasks={tasks} />
        </div>
        <div>
          <ActivityFeed
            initialActivity={activity}
            agents={agents.map((a) => ({ id: a.id, name: a.name }))}
          />
        </div>
      </div>
    </div>
  );
}
