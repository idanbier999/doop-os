import { createAdminClient } from "@/lib/supabase/admin";
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
  const supabase = createAdminClient();

  // Fetch agent
  const { data: agent, error: agentError } = await supabase
    .from("agents")
    .select("id, webhook_url")
    .eq("id", agentId)
    .single();

  if (agentError || !agent) {
    return { success: false, method: "queue", error: "Agent not found" };
  }

  // Fetch task with project context, scoped to workspace for access control
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select(
      "id, title, description, priority, status, project:projects(id, name, instructions, orchestration_mode)"
    )
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single();

  if (taskError || !task) {
    return { success: false, method: "queue", error: "Task not found" };
  }

  // Has webhook_url → push via webhook
  if (agent.webhook_url) {
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
      project: task.project ?? null,
      agent: { id: agentId },
    };

    const result = await dispatchToAgent(agentId, payload, taskId);

    if (result.success) {
      // Update task status to in_progress with optimistic lock
      // Note: Even if this update fails (0 rows due to race condition), we still
      // return success because the webhook was already sent and cannot be recalled.
      await supabase
        .from("tasks")
        .update({ status: "in_progress", agent_id: agentId, updated_at: new Date().toISOString() })
        .eq("id", taskId)
        .in("status", ["pending", "waiting_on_agent"]);

      return { success: true, method: "webhook", deliveryId: result.deliveryId };
    }

    return { success: false, method: "webhook", error: result.error };
  }

  // No webhook_url → queue-based delivery (polling)
  await supabase
    .from("tasks")
    .update({ status: "waiting_on_agent", agent_id: agentId, updated_at: new Date().toISOString() })
    .eq("id", taskId)
    .in("status", ["pending", "waiting_on_agent"]);

  return { success: true, method: "queue" };
}

export async function notifyLeadAgent(
  projectId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const supabase = createAdminClient();

    const { data: project } = await supabase
      .from("projects")
      .select("id, lead_agent_id, orchestration_mode")
      .eq("id", projectId)
      .single();

    if (!project || project.orchestration_mode !== "lead_agent" || !project.lead_agent_id) {
      return;
    }

    await dispatchToAgent(project.lead_agent_id, { event, project_id: projectId, ...payload });
  } catch (err) {
    console.warn("notifyLeadAgent failed:", err);
  }
}
