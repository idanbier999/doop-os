import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { redirect, notFound } from "next/navigation";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", user.id)
    .single();
  if (!membership) redirect("/onboarding");

  const { data: project } = await supabase
    .from("projects")
    .select("*, lead_agent:agents!projects_lead_agent_id_fkey(id, name)")
    .eq("id", id)
    .eq("workspace_id", membership.workspace_id)
    .single();
  if (!project) notFound();

  const { data: projectAgents } = await supabase
    .from("project_agents")
    .select("*, agent:agents!project_agents_agent_id_fkey(id, name, health, stage, webhook_url)")
    .eq("project_id", id);

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, task_agents(agent_id, role, agents(name))")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const taskIds = (tasks || []).map((t) => t.id);

  const { data: dependencies } =
    taskIds.length > 0
      ? await supabase.from("task_dependencies").select("*").in("task_id", taskIds)
      : { data: [] };

  const { data: files } = await supabase
    .from("project_files")
    .select("*")
    .eq("project_id", id)
    .order("created_at", { ascending: false });

  const { data: activity } = await supabase
    .from("activity_log")
    .select("*")
    .eq("workspace_id", membership.workspace_id)
    .order("created_at", { ascending: false })
    .limit(50);

  const { data: workspaceAgents } = await supabase
    .from("agents")
    .select("id, name, health, stage")
    .eq("workspace_id", membership.workspace_id);

  // Fetch open problems linked to project tasks
  let problems: { id: string; task_id: string | null; severity: string; status: string }[] = [];
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("problems")
      .select("id, task_id, severity, status")
      .in("task_id", taskIds)
      .eq("status", "open");
    problems = data || [];
  }

  const agentIds = (projectAgents || []).map((pa) => pa.agent_id);
  const { data: webhookStats } =
    agentIds.length > 0
      ? await supabase
          .from("webhook_deliveries")
          .select("agent_id, status")
          .in("agent_id", agentIds)
      : { data: [] };

  return (
    <ProjectDetailClient
      project={project}
      initialProjectAgents={projectAgents || []}
      initialTasks={tasks || []}
      initialDependencies={dependencies || []}
      initialFiles={files || []}
      initialActivity={activity || []}
      initialProblems={problems}
      workspaceAgents={workspaceAgents || []}
      webhookStats={webhookStats || []}
      userRole={membership.role}
      workspaceId={membership.workspace_id}
    />
  );
}
