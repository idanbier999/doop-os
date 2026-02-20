import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getAgentStats } from "@/lib/agent-stats";
import { StatusHeader } from "@/components/agents/status-header";
import { HealthSparkline } from "@/components/agents/health-sparkline";
import { PerformanceCards } from "@/components/agents/performance-cards";
import { Timeline } from "@/components/agents/timeline";
import { AgentProblemsPanel } from "@/components/agents/agent-problems-panel";
import { AgentTasksPanel } from "@/components/agents/agent-tasks-panel";
import { MetadataViewer } from "@/components/agents/metadata-viewer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const supabase = await createClient();
  const { data: agent } = await supabase
    .from("agents")
    .select("name")
    .eq("id", id)
    .single();

  return {
    title: agent ? `${agent.name} | Mangistew` : "Agent Detail | Mangistew",
  };
}

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("id, name, health, stage, agent_type, last_seen_at, workspace_id, tags, description, metadata, platform, created_at, updated_at")
    .eq("id", id)
    .single();

  if (!agent) {
    notFound();
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [updatesResult, problemsResult, tasksResult, stats] = await Promise.all([
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
      .select("id, title, description, status, priority, agent_id, assigned_to, board_id, result, workspace_id, created_by, created_at, updated_at")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    getAgentStats(supabase, id),
  ]);

  const updates = updatesResult.data ?? [];
  const problems = problemsResult.data ?? [];
  const tasks = tasksResult.data ?? [];

  // Filter updates from last 7 days for sparkline
  const recentUpdates = updates.filter(
    (u) => u.created_at && u.created_at >= sevenDaysAgo
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <StatusHeader agent={agent} />
        </div>
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
