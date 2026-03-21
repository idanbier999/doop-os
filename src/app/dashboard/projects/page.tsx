import type { Metadata } from "next";
import { requireWorkspaceMembership } from "@/lib/workspace";
import { getDb } from "@/lib/db/client";
import { projects, projectAgents, agents as agentsTable, tasks } from "@/lib/db/schema";
import { eq, and, isNotNull, desc, sql } from "drizzle-orm";
import { ProjectsPageClient } from "@/components/projects/projects-page-client";

export const metadata: Metadata = { title: "Projects | Doop" };

export default async function ProjectsPage() {
  const { workspace } = await requireWorkspaceMembership();
  const workspaceId = workspace.id;

  const db = getDb();

  // Fetch projects
  const projectRows = await db
    .select()
    .from(projects)
    .where(eq(projects.workspaceId, workspaceId))
    .orderBy(desc(projects.createdAt));

  const projectIds = projectRows.map((p) => p.id);

  // Get agent counts per project
  const agentCounts =
    projectIds.length > 0
      ? await db
          .select({
            projectId: projectAgents.projectId,
            count: sql<number>`count(*)`.as("count"),
          })
          .from(projectAgents)
          .where(sql`${projectAgents.projectId} = ANY(${projectIds})`)
          .groupBy(projectAgents.projectId)
      : [];

  const agentCountMap: Record<string, number> = {};
  for (const ac of agentCounts) {
    agentCountMap[ac.projectId] = Number(ac.count);
  }

  // Get lead agent names
  const leadAgentIds = projectRows
    .map((p) => p.leadAgentId)
    .filter((id): id is string => id !== null);

  const leadAgentNames: Record<string, string> = {};
  if (leadAgentIds.length > 0) {
    const leadAgents = await db
      .select({ id: agentsTable.id, name: agentsTable.name })
      .from(agentsTable)
      .where(sql`${agentsTable.id} = ANY(${leadAgentIds})`);
    for (const la of leadAgents) {
      leadAgentNames[la.id] = la.name;
    }
  }

  // Build the exact ProjectRow shape the client component expects (snake_case)
  const serializedProjects = projectRows.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    status: p.status,
    orchestration_mode: p.orchestrationMode,
    lead_agent_id: p.leadAgentId,
    workspace_id: p.workspaceId,
    created_at: p.createdAt?.toISOString() ?? null,
    updated_at: p.updatedAt?.toISOString() ?? null,
    created_by: p.createdBy,
    instructions: p.instructions,
    project_agents: [{ count: agentCountMap[p.id] ?? 0 }],
    lead_agent:
      p.leadAgentId && leadAgentNames[p.leadAgentId]
        ? { name: leadAgentNames[p.leadAgentId] }
        : null,
  }));

  // Get task stats (project_id + status for all tasks with a project)
  const taskStats = await db
    .select({ project_id: tasks.projectId, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), isNotNull(tasks.projectId)));

  // Get workspace agents
  const agentRows = await db
    .select({
      id: agentsTable.id,
      name: agentsTable.name,
      health: agentsTable.health,
      agent_type: agentsTable.agentType,
    })
    .from(agentsTable)
    .where(eq(agentsTable.workspaceId, workspaceId));

  return (
    <ProjectsPageClient
      initialProjects={serializedProjects}
      taskStats={taskStats}
      agents={agentRows}
    />
  );
}
