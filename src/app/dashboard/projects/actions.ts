"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { requireWorkspaceMember } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import {
  projects,
  projectAgents,
  projectFiles,
  tasks,
  taskAgents,
  taskDependencies,
  activityLog,
  agents,
} from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { dispatchToAgent } from "@/lib/webhook-dispatch";

const createProjectSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  instructions: z.string().max(5000).optional(),
  orchestration_mode: z.enum(["manual", "lead_agent"]),
  lead_agent_id: z.string().uuid().optional(),
  agentIds: z.array(z.string().uuid()),
  leadAgentId: z.string().uuid().optional(),
  status: z.enum(["draft", "active"]),
});

const createProjectTaskSchema = z.object({
  projectId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.string().trim().min(1),
  assignedAgentId: z.string().uuid().optional(),
  dependsOnTaskIds: z.array(z.string().uuid()).optional(),
});

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
  const parsed = createProjectSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  const validatedData = parsed.data;

  // Verify workspace membership
  try {
    await requireWorkspaceMember(user.id, validatedData.workspaceId);
  } catch {
    return { success: false, error: "Not a workspace member" };
  }

  const db = getDb();

  // Create project
  const [project] = await db
    .insert(projects)
    .values({
      workspaceId: validatedData.workspaceId,
      name: validatedData.name,
      description: validatedData.description || null,
      instructions: validatedData.instructions || null,
      orchestrationMode: validatedData.orchestration_mode,
      leadAgentId: validatedData.leadAgentId || null,
      status: validatedData.status,
      createdBy: user.id,
    })
    .returning({ id: projects.id });

  if (!project) {
    return { success: false, error: "Failed to create project" };
  }

  // Add agents to project
  if (validatedData.agentIds.length > 0) {
    const agentRows = validatedData.agentIds.map((agentId) => ({
      projectId: project.id,
      agentId,
      role: agentId === validatedData.leadAgentId ? ("lead" as const) : ("member" as const),
      status: validatedData.status === "active" ? ("working" as const) : ("idle" as const),
    }));
    await db.insert(projectAgents).values(agentRows);
  }

  // Log activity
  await db.insert(activityLog).values({
    workspaceId: validatedData.workspaceId,
    userId: user.id,
    action: validatedData.status === "active" ? "project_launched" : "project_created",
    details: {
      project_id: project.id,
      name: validatedData.name,
      orchestration_mode: validatedData.orchestration_mode,
    },
  });

  return { success: true, projectId: project.id };
}

export async function updateProjectStatus(
  projectId: string,
  workspaceId: string,
  newStatus: string
) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await requireWorkspaceMember(user.id, workspaceId);
  } catch {
    return { success: false, error: "Not a workspace member" };
  }

  const db = getDb();

  await db
    .update(projects)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)));

  // When launching (draft -> active), set all project_agents to 'working'
  if (newStatus === "active") {
    await db
      .update(projectAgents)
      .set({ status: "working" })
      .where(eq(projectAgents.projectId, projectId));
  }

  // When pausing or cancelling, set agents to idle
  if (newStatus === "paused" || newStatus === "cancelled") {
    await db
      .update(projectAgents)
      .set({ status: "idle" })
      .where(eq(projectAgents.projectId, projectId));
  }

  await db.insert(activityLog).values({
    workspaceId,
    userId: user.id,
    action: `project_status_changed`,
    details: { project_id: projectId, new_status: newStatus },
  });

  return { success: true };
}

/**
 * Launches a project and, for lead_agent mode, dispatches a project.launched
 * webhook to the lead agent with full project context (instructions, files, team).
 */
export async function launchProject(projectId: string, workspaceId: string) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await requireWorkspaceMember(user.id, workspaceId);
  } catch {
    return { success: false, error: "Not a workspace member" };
  }

  const db = getDb();

  // Fetch full project
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, workspaceId)))
    .limit(1);

  if (!project) return { success: false, error: "Project not found" };

  // Set project to active
  await db
    .update(projects)
    .set({ status: "active", updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  // Set all project_agents to 'working'
  await db
    .update(projectAgents)
    .set({ status: "working" })
    .where(eq(projectAgents.projectId, projectId));

  await db.insert(activityLog).values({
    workspaceId,
    userId: user.id,
    action: "project_launched",
    details: {
      project_id: projectId,
      name: project.name,
      orchestration_mode: project.orchestrationMode,
    },
  });

  // For lead_agent mode: dispatch project.launched webhook to the lead agent
  if (project.orchestrationMode === "lead_agent" && project.leadAgentId) {
    // Gather team agents
    const paRows = await db
      .select({
        role: projectAgents.role,
        agentId: agents.id,
        agentName: agents.name,
        capabilities: agents.capabilities,
        agentType: agents.agentType,
      })
      .from(projectAgents)
      .innerJoin(agents, eq(projectAgents.agentId, agents.id))
      .where(eq(projectAgents.projectId, projectId));

    // Gather project files metadata
    const files = await db
      .select({
        id: projectFiles.id,
        fileName: projectFiles.fileName,
        filePath: projectFiles.filePath,
        mimeType: projectFiles.mimeType,
        fileSize: projectFiles.fileSize,
      })
      .from(projectFiles)
      .where(eq(projectFiles.projectId, projectId));

    const teamAgents = paRows.map((pa) => ({
      id: pa.agentId,
      name: pa.agentName,
      capabilities: pa.capabilities,
      agent_type: pa.agentType,
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
        orchestration_mode: project.orchestrationMode,
      },
      team_agents: teamAgents,
      files: files.map((f) => ({
        id: f.id,
        file_name: f.fileName,
        file_path: f.filePath,
        mime_type: f.mimeType,
        file_size: f.fileSize,
      })),
    };

    // Fire-and-forget -- don't block the response on webhook success
    dispatchToAgent(project.leadAgentId, launchPayload).catch(console.error);
  }

  return { success: true };
}

/**
 * Dispatches a single task to its assigned agent via webhook.
 * Used in manual orchestration mode for pushing individual tasks.
 */
export async function dispatchTaskToAgent(taskId: string, workspaceId: string) {
  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await requireWorkspaceMember(user.id, workspaceId);
  } catch {
    return { success: false, error: "Not a workspace member" };
  }

  const db = getDb();

  // Fetch task
  const [task] = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, workspaceId)))
    .limit(1);

  if (!task) return { success: false, error: "Task not found" };
  if (!task.agentId) return { success: false, error: "Task has no assigned agent" };

  // Fetch project context if available
  let project: {
    id: string;
    name: string;
    instructions: string | null;
    orchestrationMode: string;
  } | null = null;

  if (task.projectId) {
    const [p] = await db
      .select({
        id: projects.id,
        name: projects.name,
        instructions: projects.instructions,
        orchestrationMode: projects.orchestrationMode,
      })
      .from(projects)
      .where(eq(projects.id, task.projectId))
      .limit(1);
    project = p ?? null;
  }

  const taskPayload = {
    event: "task.assigned",
    timestamp: new Date().toISOString(),
    task: {
      id: task.id,
      title: task.title,
      description: task.description,
      priority: task.priority,
      status: task.status,
    },
    project: project
      ? {
          id: project.id,
          name: project.name,
          instructions: project.instructions,
          orchestration_mode: project.orchestrationMode,
        }
      : null,
    agent: { id: task.agentId },
  };

  const result = await dispatchToAgent(task.agentId, taskPayload, task.id);

  if (result.success) {
    await db.insert(activityLog).values({
      workspaceId,
      userId: user.id,
      action: "task_dispatched",
      details: { task_id: task.id, title: task.title, agent_id: task.agentId },
    });
  }

  return result.success ? { success: true } : { success: false, error: result.error };
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
  const parsed = createProjectTaskSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0].message };
  }

  const validatedData = parsed.data;

  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await requireWorkspaceMember(user.id, validatedData.workspaceId);
  } catch {
    return { success: false, error: "Not a workspace member" };
  }

  const db = getDb();

  const [task] = await db
    .insert(tasks)
    .values({
      workspaceId: validatedData.workspaceId,
      projectId: validatedData.projectId,
      title: validatedData.title,
      description: validatedData.description || null,
      priority: validatedData.priority,
      status: "pending",
      agentId: validatedData.assignedAgentId || null,
      createdBy: user.id,
    })
    .returning({ id: tasks.id });

  if (!task) {
    return { success: false, error: "Failed to create task" };
  }

  if (validatedData.assignedAgentId) {
    await db.insert(taskAgents).values({
      taskId: task.id,
      agentId: validatedData.assignedAgentId,
      role: "assignee",
    });
  }

  if (validatedData.dependsOnTaskIds && validatedData.dependsOnTaskIds.length > 0) {
    const depRows = validatedData.dependsOnTaskIds.map((depId) => ({
      taskId: task.id,
      dependsOnTaskId: depId,
    }));
    await db.insert(taskDependencies).values(depRows);
  }

  await db.insert(activityLog).values({
    workspaceId: validatedData.workspaceId,
    userId: user.id,
    action: "task_created",
    details: {
      task_id: task.id,
      title: validatedData.title,
      project_id: validatedData.projectId,
    },
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
  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false, error: "Not authenticated" };
  }

  try {
    await requireWorkspaceMember(user.id, data.workspaceId);
  } catch {
    return { success: false, error: "Not a workspace member" };
  }

  const db = getDb();

  await db.insert(projectFiles).values({
    projectId: data.projectId,
    fileName: data.fileName,
    filePath: data.filePath,
    fileSize: data.fileSize || null,
    mimeType: data.mimeType || null,
    uploadedBy: user.id,
  });

  await db.insert(activityLog).values({
    workspaceId: data.workspaceId,
    userId: user.id,
    action: "file_uploaded",
    details: { project_id: data.projectId, file_name: data.fileName },
  });

  return { success: true };
}
