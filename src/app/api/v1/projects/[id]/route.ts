import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { projects, projectAgents, projectFiles, agents } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";
import { getStorage } from "@/lib/storage";

async function handleGet(request: NextRequest, context?: unknown) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  const db = getDb();

  // Verify agent is a project member
  const membershipRows = await db
    .select({ role: projectAgents.role })
    .from(projectAgents)
    .where(and(eq(projectAgents.projectId, id), eq(projectAgents.agentId, agent.id)))
    .limit(1);

  const membership = membershipRows[0];
  if (!membership) {
    return NextResponse.json({ error: "Agent is not a member of this project" }, { status: 403 });
  }

  // Fetch project
  const projectRows = await db
    .select({
      id: projects.id,
      name: projects.name,
      description: projects.description,
      instructions: projects.instructions,
      orchestration_mode: projects.orchestrationMode,
      status: projects.status,
      created_at: projects.createdAt,
      updated_at: projects.updatedAt,
    })
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, agent.workspaceId)))
    .limit(1);

  const project = projectRows[0];
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Fetch team with agent details via join
  const teamRaw = await db
    .select({
      role: projectAgents.role,
      status: projectAgents.status,
      agentId: agents.id,
      agentName: agents.name,
      agentCapabilities: agents.capabilities,
      agentType: agents.agentType,
      agentHealth: agents.health,
      agentWebhookUrl: agents.webhookUrl,
    })
    .from(projectAgents)
    .innerJoin(agents, eq(projectAgents.agentId, agents.id))
    .where(eq(projectAgents.projectId, id));

  const team = teamRaw.map((member) => ({
    role: member.role,
    status: member.status,
    agent: {
      id: member.agentId,
      name: member.agentName,
      capabilities: member.agentCapabilities,
      agent_type: member.agentType,
      health: member.agentHealth,
      has_webhook: !!member.agentWebhookUrl,
    },
  }));

  // Fetch files
  const files = await db
    .select({
      id: projectFiles.id,
      file_name: projectFiles.fileName,
      file_path: projectFiles.filePath,
      mime_type: projectFiles.mimeType,
      file_size: projectFiles.fileSize,
    })
    .from(projectFiles)
    .where(eq(projectFiles.projectId, id));

  // Generate URLs for files using local storage provider
  const storage = getStorage();
  const filesWithUrls = files.map((file) => ({
    ...file,
    url: storage.getUrl("project-files", file.file_path),
  }));

  return NextResponse.json({
    project,
    team,
    files: filesWithUrls,
    agent_role: membership.role,
  });
}

export const GET = withRateLimit(handleGet);
