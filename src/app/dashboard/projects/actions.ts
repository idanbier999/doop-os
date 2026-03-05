"use server";

import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToAgent } from "@/lib/webhook-dispatch";
import { deliverTaskToAgent } from "@/lib/task-delivery";

export async function createProject(data: {
  workspaceId: string;
  name: string;
  description?: string;
  instructions?: string;
  orchestration_mode: "manual" | "lead_agent";
  lead_agent_id?: string;
  agentIds: string[];
  leadAgentId?: string;
  status: "draft" | "active";
}) {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) return { success: false, error: "Not authenticated" };

  // Verify workspace membership
  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", data.workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { success: false, error: "Not a workspace member" };

  // Create project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .insert({
      workspace_id: data.workspaceId,
      name: data.name,
      description: data.description || null,
      instructions: data.instructions || null,
      orchestration_mode: data.orchestration_mode,
      lead_agent_id: data.leadAgentId || null,
      status: data.status,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (projectError || !project)
    return {
      success: false,
      error: projectError?.message || "Failed to create project",
    };

  // Add agents to project
  if (data.agentIds.length > 0) {
    const agentRows = data.agentIds.map((agentId) => ({
      project_id: project.id,
      agent_id: agentId,
      role: agentId === data.leadAgentId ? ("lead" as const) : ("member" as const),
      status: data.status === "active" ? ("working" as const) : ("idle" as const),
    }));
    await supabase.from("project_agents").insert(agentRows);
  }

  // Log activity
  await supabase.from("activity_log").insert({
    workspace_id: data.workspaceId,
    user_id: user.id,
    action:
      data.status === "active" ? "project_launched" : "project_created",
    details: {
      project_id: project.id,
      name: data.name,
      orchestration_mode: data.orchestration_mode,
    },
  });

  return { success: true, projectId: project.id };
}

export async function updateProjectStatus(
  projectId: string,
  workspaceId: string,
  newStatus: string
) {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) return { success: false, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { success: false, error: "Not a workspace member" };

  const { error } = await supabase
    .from("projects")
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq("id", projectId)
    .eq("workspace_id", workspaceId);

  if (error) return { success: false, error: error.message };

  // When launching (draft -> active), set all project_agents to 'working'
  if (newStatus === "active") {
    await supabase
      .from("project_agents")
      .update({ status: "working" })
      .eq("project_id", projectId);
  }

  // When pausing or cancelling, set agents to idle
  if (newStatus === "paused" || newStatus === "cancelled") {
    await supabase
      .from("project_agents")
      .update({ status: "idle" })
      .eq("project_id", projectId);
  }

  await supabase.from("activity_log").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    action: `project_status_changed`,
    details: { project_id: projectId, new_status: newStatus },
  });

  return { success: true };
}

/**
 * Launches a project and, for lead_agent mode, dispatches a project.launched
 * webhook to the lead agent with full project context (instructions, files, team).
 */
export async function launchProject(
  projectId: string,
  workspaceId: string
) {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) return { success: false, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { success: false, error: "Not a workspace member" };

  // Fetch full project
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("workspace_id", workspaceId)
    .single();

  if (projectError || !project) return { success: false, error: "Project not found" };

  // Set project to active
  const { error: updateError } = await supabase
    .from("projects")
    .update({ status: "active", updated_at: new Date().toISOString() })
    .eq("id", projectId);

  if (updateError) return { success: false, error: updateError.message };

  // Set all project_agents to 'working'
  await supabase
    .from("project_agents")
    .update({ status: "working" })
    .eq("project_id", projectId);

  await supabase.from("activity_log").insert({
    workspace_id: workspaceId,
    user_id: user.id,
    action: "project_launched",
    details: { project_id: projectId, name: project.name, orchestration_mode: project.orchestration_mode },
  });

  // For lead_agent mode: dispatch project.launched webhook to the lead agent
  if (project.orchestration_mode === "lead_agent" && project.lead_agent_id) {
    const adminSupabase = createAdminClient();

    // Gather team agents
    const { data: projectAgents } = await adminSupabase
      .from("project_agents")
      .select("role, agent:agents(id, name, capabilities, agent_type)")
      .eq("project_id", projectId);

    // Gather project files metadata
    const { data: projectFiles } = await adminSupabase
      .from("project_files")
      .select("id, file_name, file_path, mime_type, file_size")
      .eq("project_id", projectId);

    const teamAgents = (projectAgents ?? []).map((pa) => ({
      ...(pa.agent as Record<string, unknown>),
      role: pa.role,
    }));

    const launchPayload = {
      event: "project.launched",
      timestamp: new Date().toISOString(),
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        instructions: project.instructions,
        orchestration_mode: project.orchestration_mode,
      },
      team_agents: teamAgents,
      files: projectFiles ?? [],
    };

    // Fire-and-forget — don't block the response on webhook success
    dispatchToAgent(project.lead_agent_id, launchPayload).catch(console.error);
  }

  return { success: true };
}

/**
 * Dispatches a single task to its assigned agent via webhook.
 * Used in manual orchestration mode for pushing individual tasks.
 */
export async function dispatchTaskToAgent(taskId: string, workspaceId: string) {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) return { success: false, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { success: false, error: "Not a workspace member" };

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, title, agent_id")
    .eq("id", taskId)
    .eq("workspace_id", workspaceId)
    .single();

  if (taskError || !task) return { success: false, error: "Task not found" };
  if (!task.agent_id) return { success: false, error: "Task has no assigned agent" };

  const delivery = await deliverTaskToAgent(taskId, task.agent_id, workspaceId);

  if (delivery.success) {
    await supabase.from("activity_log").insert({
      workspace_id: workspaceId,
      user_id: user.id,
      action: delivery.method === "webhook" ? "task_dispatched" : "task_queued",
      details: { task_id: task.id, title: task.title, agent_id: task.agent_id },
    });
  }

  return delivery.success
    ? { success: true as const, method: delivery.method }
    : { success: false as const, error: delivery.error };
}

export async function createProjectTask(data: {
  projectId: string;
  workspaceId: string;
  title: string;
  description?: string;
  priority: string;
  assignedAgentId?: string;
  dependsOnTaskIds?: string[];
}) {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) return { success: false, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", data.workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { success: false, error: "Not a workspace member" };

  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      workspace_id: data.workspaceId,
      project_id: data.projectId,
      title: data.title,
      description: data.description || null,
      priority: data.priority,
      status: "pending",
      agent_id: data.assignedAgentId || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (taskError || !task) return { success: false, error: taskError?.message || "Failed to create task" };

  if (data.assignedAgentId) {
    await supabase.from("task_agents").insert({
      task_id: task.id,
      agent_id: data.assignedAgentId,
      role: "assignee",
    });
  }

  if (data.dependsOnTaskIds && data.dependsOnTaskIds.length > 0) {
    const depRows = data.dependsOnTaskIds.map((depId) => ({
      task_id: task.id,
      depends_on_task_id: depId,
    }));
    await supabase.from("task_dependencies").insert(depRows);
  }

  await supabase.from("activity_log").insert({
    workspace_id: data.workspaceId,
    user_id: user.id,
    action: "task_created",
    details: { task_id: task.id, title: data.title, project_id: data.projectId },
  });

  return { success: true, taskId: task.id };
}

export async function addProjectFile(data: {
  projectId: string;
  workspaceId: string;
  fileName: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
}) {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) return { success: false, error: "Not authenticated" };

  const { data: member } = await supabase
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", data.workspaceId)
    .eq("user_id", user.id)
    .single();
  if (!member) return { success: false, error: "Not a workspace member" };

  const { error } = await supabase.from("project_files").insert({
    project_id: data.projectId,
    file_name: data.fileName,
    file_path: data.filePath,
    file_size: data.fileSize || null,
    mime_type: data.mimeType || null,
    uploaded_by: user.id,
  });

  if (error) return { success: false, error: error.message };

  await supabase.from("activity_log").insert({
    workspace_id: data.workspaceId,
    user_id: user.id,
    action: "file_uploaded",
    details: { project_id: data.projectId, file_name: data.fileName },
  });

  return { success: true };
}
