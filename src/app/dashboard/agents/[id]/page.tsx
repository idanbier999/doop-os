import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StatusHeader } from "@/components/agents/status-header";
import { Timeline } from "@/components/agents/timeline";
import { AgentProblemsPanel } from "@/components/agents/agent-problems-panel";
import { AgentTasksPanel } from "@/components/agents/agent-tasks-panel";
import { MetadataViewer } from "@/components/agents/metadata-viewer";

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: agent } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .single();

  if (!agent) {
    notFound();
  }

  const [updatesResult, problemsResult, tasksResult] = await Promise.all([
    supabase
      .from("agent_updates")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("problems")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
    supabase
      .from("tasks")
      .select("*")
      .eq("agent_id", id)
      .order("created_at", { ascending: false }),
  ]);

  const updates = updatesResult.data ?? [];
  const problems = problemsResult.data ?? [];
  const tasks = tasksResult.data ?? [];

  return (
    <div className="space-y-6">
      <StatusHeader agent={agent} />

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
