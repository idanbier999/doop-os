import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { getAgentStats } from "@/lib/agent-stats";
import { StatusHeader } from "@/components/agents/status-header";
import { HealthSparkline } from "@/components/agents/health-sparkline";
import { PerformanceCards } from "@/components/agents/performance-cards";
import { Timeline } from "@/components/agents/timeline";
import { AgentProblemsPanel } from "@/components/agents/agent-problems-panel";
import { AgentTasksPanel } from "@/components/agents/agent-tasks-panel";
import { MetadataViewer } from "@/components/agents/metadata-viewer";
import { AgentDetailActions } from "@/components/agents/agent-detail-actions";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const { supabase } = await getAuthenticatedSupabase();
  const { data: agent } = await supabase!
    .from("agents")
    .select("name")
    .eq("id", id)
    .single();

  return {
    title: agent ? `${agent.name} | Tarely` : "Agent Detail | Tarely",
  };
}

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;
  const { user, supabase: sb } = await getAuthenticatedSupabase();
  const supabase = sb!;

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, health, stage, agent_type, last_seen_at, workspace_id, tags, description, metadata, platform, created_at, updated_at, capabilities, webhook_url, webhook_secret, owner_id")
    .eq("id", id)
    .single();

  if (!agent) {
    notFound();
  }

  let ownerName: string | null = null;
  if (agent.owner_id) {
    const { data: ownerData } = await supabase
      .from("workspace_members")
      .select("user:user!workspace_members_user_id_fkey(name)")
      .eq("workspace_id", agent.workspace_id)
      .eq("user_id", agent.owner_id)
      .single();
    ownerName = (ownerData?.user as unknown as { name: string | null } | null)?.name ?? null;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [updatesResult, problemsResult, tasksResult, stats, membershipResult] = await Promise.all([
    supabase
      .from("agent_updates")
      .select("id, agent_id, health, stage, message, details, created_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("problems")
      .select("id, agent_id, title, description, severity, status, task_id, created_at, resolved_at, resolved_by")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("id, title, description, status, priority, agent_id, assigned_to, result, workspace_id, created_by, created_at, updated_at, project_id")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    getAgentStats(supabase, id),
    supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", agent.workspace_id)
      .eq("user_id", user!.id)
      .single(),
  ]);

  const updates = updatesResult.data ?? [];
  const problems = problemsResult.data ?? [];
  const tasks = tasksResult.data ?? [];
  const userRole = membershipResult.data?.role ?? "member";

  // Filter updates from last 7 days for sparkline
  const recentUpdates = updates.filter(
    (u) => u.created_at && u.created_at >= sevenDaysAgo
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <StatusHeader agent={agent} ownerName={ownerName} />
        </div>
        <AgentDetailActions
          agentId={agent.id}
          agentName={agent.name}
          currentOwnerId={agent.owner_id}
          workspaceId={agent.workspace_id}
          userRole={userRole}
        />
        <div className="hidden sm:block">
          <HealthSparkline updates={recentUpdates} currentHealth={agent.health} />
        </div>
      </div>

      <PerformanceCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Timeline agentId={id} initialUpdates={updates} />
          <MetadataViewer metadata={agent.metadata} />
        </div>
        <div className="space-y-6">
          <AgentProblemsPanel agentId={id} initialProblems={problems} />
          <AgentTasksPanel agentId={id} initialTasks={tasks} />
        </div>
      </div>
    </div>
  );
}
