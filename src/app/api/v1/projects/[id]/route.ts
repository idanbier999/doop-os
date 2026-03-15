import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";

async function handleGet(request: NextRequest, context?: unknown) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  const supabase = createAdminClient();

  // Verify agent is a project member
  const { data: membership } = await supabase
    .from("project_agents")
    .select("role")
    .eq("project_id", id)
    .eq("agent_id", agent.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: "Agent is not a member of this project" }, { status: 403 });
  }

  // Fetch project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "id, name, description, instructions, orchestration_mode, status, created_at, updated_at"
    )
    .eq("id", id)
    .eq("workspace_id", agent.workspace_id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch team
  const { data: teamRaw } = await supabase
    .from("project_agents")
    .select(
      "role, status, agent:agents!project_agents_agent_id_fkey(id, name, capabilities, agent_type, health, webhook_url)"
    )
    .eq("project_id", id);

  interface ProjectTeamMember {
    role: string;
    status: string;
    agent: {
      id: string;
      name: string;
      capabilities: string[] | null;
      agent_type: string | null;
      health: string;
      webhook_url: string | null;
    } | null;
  }

  const team = (teamRaw ?? []).map((member: ProjectTeamMember) => ({
    role: member.role,
    status: member.status,
    agent: member.agent
      ? {
          id: member.agent.id,
          name: member.agent.name,
          capabilities: member.agent.capabilities,
          agent_type: member.agent.agent_type,
          health: member.agent.health,
          has_webhook: !!member.agent.webhook_url,
        }
      : null,
  }));

  // Fetch files
  const { data: files } = await supabase
    .from("project_files")
    .select("id, file_name, file_path, mime_type, file_size")
    .eq("project_id", id);

  return NextResponse.json({
    project,
    team,
    files: files ?? [],
    agent_role: membership.role,
  });
}

export const GET = withRateLimit(handleGet);
