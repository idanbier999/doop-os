import { notFound } from "next/navigation";
import { requireWorkspaceMembership } from "@/lib/workspace";
import { getDb } from "@/lib/db/client";
import {
  projects,
  projectAgents,
  projectFiles,
  tasks,
  taskAgents,
  taskDependencies,
  activityLog,
  agents as agentsTable,
  problems as problemsTable,
  webhookDeliveries,
} from "@/lib/db/schema";
import { eq, and, inArray, desc } from "drizzle-orm";
import { ProjectDetailClient } from "@/components/projects/project-detail-client";

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { workspace, role } = await requireWorkspaceMembership();
  const workspaceId = workspace.id;

  const db = getDb();

  // Fetch project
  const [projectRow] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.workspaceId, workspaceId)))
    .limit(1);

  if (!projectRow) notFound();

  // Get lead agent name if exists
  let leadAgent: { id: string; name: string } | null = null;
  if (projectRow.leadAgentId) {
    const [la] = await db
      .select({ id: agentsTable.id, name: agentsTable.name })
      .from(agentsTable)
      .where(eq(agentsTable.id, projectRow.leadAgentId))
      .limit(1);
    leadAgent = la ?? null;
  }

  // Fetch project agents with agent details
  const paRows = await db
    .select({
      id: projectAgents.id,
      projectId: projectAgents.projectId,
      agentId: projectAgents.agentId,
      role: projectAgents.role,
      status: projectAgents.status,
      createdAt: projectAgents.createdAt,
      agentName: agentsTable.name,
      agentHealth: agentsTable.health,
      agentStage: agentsTable.stage,
      agentWebhookUrl: agentsTable.webhookUrl,
    })
    .from(projectAgents)
    .innerJoin(agentsTable, eq(projectAgents.agentId, agentsTable.id))
    .where(eq(projectAgents.projectId, id));

  // Fetch tasks for this project
  const taskRows = await db
    .select()
    .from(tasks)
    .where(eq(tasks.projectId, id))
    .orderBy(desc(tasks.createdAt));

  const taskIds = taskRows.map((t) => t.id);

  // Get task agents with agent names
  const taRows =
    taskIds.length > 0
      ? await db
          .select({
            taskId: taskAgents.taskId,
            agentId: taskAgents.agentId,
            role: taskAgents.role,
            agentName: agentsTable.name,
          })
          .from(taskAgents)
          .innerJoin(agentsTable, eq(taskAgents.agentId, agentsTable.id))
          .where(inArray(taskAgents.taskId, taskIds))
      : [];

  // Group task agents by task id
  const taskAgentsByTaskId: Record<
    string,
    Array<{ agent_id: string; role: string; agents: { name: string } }>
  > = {};
  for (const ta of taRows) {
    if (!taskAgentsByTaskId[ta.taskId]) taskAgentsByTaskId[ta.taskId] = [];
    taskAgentsByTaskId[ta.taskId].push({
      agent_id: ta.agentId,
      role: ta.role,
      agents: { name: ta.agentName },
    });
  }

  // Fetch dependencies
  const dependencies =
    taskIds.length > 0
      ? await db.select().from(taskDependencies).where(inArray(taskDependencies.taskId, taskIds))
      : [];

  // Fetch project files
  const files = await db
    .select()
    .from(projectFiles)
    .where(eq(projectFiles.projectId, id))
    .orderBy(desc(projectFiles.createdAt));

  // Fetch activity
  const activityRows = await db
    .select()
    .from(activityLog)
    .where(eq(activityLog.workspaceId, workspaceId))
    .orderBy(desc(activityLog.createdAt))
    .limit(50);

  // Fetch workspace agents
  const wsAgents = await db
    .select({
      id: agentsTable.id,
      name: agentsTable.name,
      health: agentsTable.health,
      stage: agentsTable.stage,
    })
    .from(agentsTable)
    .where(eq(agentsTable.workspaceId, workspaceId));

  // Fetch open problems linked to project tasks
  let problemsList: { id: string; taskId: string | null; severity: string; status: string }[] = [];
  if (taskIds.length > 0) {
    const problemRows = await db
      .select({
        id: problemsTable.id,
        taskId: problemsTable.taskId,
        severity: problemsTable.severity,
        status: problemsTable.status,
      })
      .from(problemsTable)
      .where(and(inArray(problemsTable.taskId, taskIds), eq(problemsTable.status, "open")));
    problemsList = problemRows.map((p) => ({
      id: p.id,
      taskId: p.taskId,
      severity: p.severity,
      status: p.status,
    }));
  }

  // Fetch webhook stats for project agents
  const agentIds = paRows.map((pa) => pa.agentId);
  const webhookStats =
    agentIds.length > 0
      ? await db
          .select({
            agentId: webhookDeliveries.agentId,
            status: webhookDeliveries.status,
          })
          .from(webhookDeliveries)
          .where(inArray(webhookDeliveries.agentId, agentIds))
      : [];

  // Build serialized shapes matching what the client component expects
  // The component types extend Tables<"X"> which now map to camelCase Drizzle types,
  // but the component code still accesses some fields with snake_case.
  // We merge both camelCase and snake_case to bridge this gap.
  const project = {
    ...projectRow,
    lead_agent: leadAgent,
  };

  const serializedProjectAgents = paRows.map((pa) => ({
    id: pa.id,
    projectId: pa.projectId,
    agentId: pa.agentId,
    role: pa.role,
    status: pa.status,
    createdAt: pa.createdAt,
    agent: {
      id: pa.agentId,
      name: pa.agentName,
      health: pa.agentHealth,
      stage: pa.agentStage,
      webhookUrl: pa.agentWebhookUrl,
    },
  }));

  const serializedTasks = taskRows.map((t) => ({
    ...t,
    task_agents: taskAgentsByTaskId[t.id] ?? [],
  }));

  const serializedWebhookStats = webhookStats.map((ws) => ({
    agentId: ws.agentId,
    status: ws.status,
  }));

  return (
    <ProjectDetailClient
      project={project}
      initialProjectAgents={serializedProjectAgents}
      initialTasks={serializedTasks}
      initialDependencies={dependencies}
      initialFiles={files}
      initialActivity={activityRows}
      initialProblems={problemsList}
      workspaceAgents={wsAgents}
      webhookStats={serializedWebhookStats}
      userRole={role}
      workspaceId={workspaceId}
    />
  );
}
