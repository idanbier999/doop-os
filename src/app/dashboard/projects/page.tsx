import type { Metadata } from "next";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { redirect } from "next/navigation";
import { ProjectsPageClient } from "@/components/projects/projects-page-client";

export const metadata: Metadata = { title: "Projects | Tarely" };

export default async function ProjectsPage() {
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

  const { data: projects } = await supabase
    .from("projects")
    .select(
      "*, project_agents(count), lead_agent:agents!projects_lead_agent_id_fkey(name)"
    )
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false });

  const { data: taskStats } = await supabase
    .from("tasks")
    .select("project_id, status")
    .eq("workspace_id", workspaceId)
    .not("project_id", "is", null);

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, health, agent_type")
    .eq("workspace_id", workspaceId)
    .order("name");

  return (
    <ProjectsPageClient
      initialProjects={projects || []}
      taskStats={taskStats || []}
      agents={agents || []}
    />
  );
}
