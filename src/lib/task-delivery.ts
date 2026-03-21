import { getDb } from "@/lib/db/client";
import { agents, tasks, projects } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { dispatchToAgent } from "@/lib/webhook-dispatch";

export interface DeliveryResult {
  success: boolean;
  method: "webhook" | "queue";
  deliveryId?: string;
  error?: string;
}

export async function deliverTaskToAgent(
  taskId: string,
  agentId: string,
  workspaceId: string
): Promise<DeliveryResult> {
  const db = getDb();

  // Fetch agent
  const agentRows = await db
    .select({ id: agents.id, webhookUrl: agents.webhookUrl })
    .from(agents)
    .where(eq(agents.id, agentId))
    .limit(1);

  const agent = agentRows[0];
  if (!agent) {
    return { success: false, method: "queue", error: "Agent not found" };
  }

  // Fetch task with project context, scoped to workspace for access control
  const taskRows = await db
    .select({
      id: tasks.id,
      title: tasks.title,
      description: tasks.description,
      priority: tasks.priority,
      status: tasks.status,
      projectId: tasks.projectId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  const task = taskRows[0];
  if (!task) {
    return { success: false, method: "queue", error: "Task not found" };
  }

  // Fetch project context if available
  let project: {
    id: string;
    name: string;
    instructions: string | null;
    orchestrationMode: string;
  } | null = null;

  if (task.projectId) {
    const projectRows = await db
      .select({
        id: projects.id,
        name: projects.name,
        instructions: projects.instructions,
        orchestrationMode: projects.orchestrationMode,
      })
      .from(projects)
      .where(eq(projects.id, task.projectId))
      .limit(1);

    project = projectRows[0] ?? null;
  }

  // Has webhook_url -> push via webhook
  if (agent.webhookUrl) {
    const payload = {
      event: "task.assigned",
      timestamp: new Date().toISOString(),
      task: {
        id: task.id,
        title: task.title,
        description: task.description,
        priority: task.priority,
        status: task.status,
      },
      project,
      agent: { id: agentId },
    };

    const result = await dispatchToAgent(agentId, payload, taskId);

    if (result.success) {
      // Update task status to in_progress with optimistic lock
      // Note: Even if this update fails (0 rows due to race condition), we still
      // return success because the webhook was already sent and cannot be recalled.
      await db
        .update(tasks)
        .set({
          status: "in_progress",
          agentId,
          updatedAt: new Date(),
        })
        .where(and(eq(tasks.id, taskId), inArray(tasks.status, ["pending", "waiting_on_agent"])));

      return { success: true, method: "webhook", deliveryId: result.deliveryId };
    }

    return { success: false, method: "webhook", error: result.error };
  }

  // No webhook_url -> queue-based delivery (polling)
  await db
    .update(tasks)
    .set({
      status: "waiting_on_agent",
      agentId,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, taskId), inArray(tasks.status, ["pending", "waiting_on_agent"])));

  return { success: true, method: "queue" };
}

export async function notifyLeadAgent(
  projectId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const db = getDb();

    const projectRows = await db
      .select({
        id: projects.id,
        leadAgentId: projects.leadAgentId,
        orchestrationMode: projects.orchestrationMode,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    const project = projectRows[0];
    if (!project || project.orchestrationMode !== "lead_agent" || !project.leadAgentId) {
      return;
    }

    await dispatchToAgent(project.leadAgentId, { event, project_id: projectId, ...payload });
  } catch (err) {
    console.warn("notifyLeadAgent failed:", err);
  }
}
