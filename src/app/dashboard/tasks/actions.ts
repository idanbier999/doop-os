"use server";

import { z } from "zod";
import { requireAuth } from "@/lib/auth/session";
import { requireWorkspaceMember } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { tasks, taskAgents, taskComments, activityLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";

// ---------------------------------------------------------------------------
// Create Task
// ---------------------------------------------------------------------------

const createTaskSchema = z.object({
  workspaceId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(5000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]),
  agentAssignments: z.array(
    z.object({
      agent_id: z.string().uuid(),
      role: z.enum(["primary", "helper"]),
    })
  ),
});

export async function createTask(data: {
  workspaceId: string;
  title: string;
  description?: string;
  priority: string;
  agentAssignments: { agent_id: string; role: "primary" | "helper" }[];
}) {
  const parsed = createTaskSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false as const, error: "Not authenticated" };
  }

  const v = parsed.data;

  try {
    await requireWorkspaceMember(user.id, v.workspaceId);
  } catch {
    return { success: false as const, error: "Not a workspace member" };
  }

  const db = getDb();

  const primaryAgent = v.agentAssignments.find((a) => a.role === "primary");

  const [task] = await db
    .insert(tasks)
    .values({
      workspaceId: v.workspaceId,
      title: v.title,
      description: v.description || null,
      priority: v.priority,
      agentId: primaryAgent?.agent_id ?? null,
      assignedTo: null,
      createdBy: user.id,
      status: "pending",
    })
    .returning({ id: tasks.id });

  if (!task) {
    return { success: false as const, error: "Failed to create task" };
  }

  // Insert agent assignments into junction table
  if (v.agentAssignments.length > 0) {
    try {
      await db.insert(taskAgents).values(
        v.agentAssignments.map((a) => ({
          taskId: task.id,
          agentId: a.agent_id,
          role: a.role,
        }))
      );
    } catch (err) {
      return {
        success: false as const,
        error: "Task created but agent assignment failed",
        taskId: task.id,
      };
    }
  }

  // Log activity (best-effort)
  try {
    await db.insert(activityLog).values({
      workspaceId: v.workspaceId,
      userId: user.id,
      agentId: primaryAgent?.agent_id ?? null,
      action: "task_created",
      details: {
        task_id: task.id,
        title: v.title,
        priority: v.priority,
        agent_count: v.agentAssignments.length,
      },
    });
  } catch {
    // best-effort
  }

  return { success: true as const, taskId: task.id };
}

// ---------------------------------------------------------------------------
// Update Task (status, priority)
// ---------------------------------------------------------------------------

const updateTaskSchema = z.object({
  taskId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  status: z.string().optional(),
  priority: z.string().optional(),
});

export async function updateTask(data: {
  taskId: string;
  workspaceId: string;
  status?: string;
  priority?: string;
}) {
  const parsed = updateTaskSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false as const, error: "Not authenticated" };
  }

  const v = parsed.data;

  try {
    await requireWorkspaceMember(user.id, v.workspaceId);
  } catch {
    return { success: false as const, error: "Not a workspace member" };
  }

  const db = getDb();

  // Fetch current task for activity log
  const [currentTask] = await db
    .select({ status: tasks.status, priority: tasks.priority })
    .from(tasks)
    .where(and(eq(tasks.id, v.taskId), eq(tasks.workspaceId, v.workspaceId)))
    .limit(1);

  if (!currentTask) {
    return { success: false as const, error: "Task not found" };
  }

  const updateFields: Record<string, unknown> = { updatedAt: new Date() };
  if (v.status !== undefined) updateFields.status = v.status;
  if (v.priority !== undefined) updateFields.priority = v.priority;

  await db
    .update(tasks)
    .set(updateFields)
    .where(and(eq(tasks.id, v.taskId), eq(tasks.workspaceId, v.workspaceId)));

  // Log activity
  const details: Record<string, unknown> = { task_id: v.taskId };
  if (v.status !== undefined) {
    details.field = "status";
    details.old_value = currentTask.status;
    details.new_value = v.status;
  }
  if (v.priority !== undefined) {
    details.field = details.field ? "status,priority" : "priority";
    details.old_priority = currentTask.priority;
    details.new_priority = v.priority;
  }

  try {
    await db.insert(activityLog).values({
      workspaceId: v.workspaceId,
      agentId: null,
      userId: user.id,
      action: "task_updated",
      details,
    });
  } catch {
    // best-effort
  }

  return { success: true as const };
}

// ---------------------------------------------------------------------------
// Update Task Agent Assignments
// ---------------------------------------------------------------------------

const updateTaskAgentsSchema = z.object({
  taskId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  assignments: z.array(
    z.object({
      agent_id: z.string().uuid(),
      role: z.enum(["primary", "helper"]),
    })
  ),
  currentAssignments: z.array(
    z.object({
      agent_id: z.string().uuid(),
      role: z.enum(["primary", "helper"]),
    })
  ),
});

export async function updateTaskAgents(data: {
  taskId: string;
  workspaceId: string;
  assignments: { agent_id: string; role: "primary" | "helper" }[];
  currentAssignments: { agent_id: string; role: "primary" | "helper" }[];
}) {
  const parsed = updateTaskAgentsSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false as const, error: "Not authenticated" };
  }

  const v = parsed.data;

  try {
    await requireWorkspaceMember(user.id, v.workspaceId);
  } catch {
    return { success: false as const, error: "Not a workspace member" };
  }

  const db = getDb();

  const currentIds = new Set(v.currentAssignments.map((a) => a.agent_id));
  const newIds = new Set(v.assignments.map((a) => a.agent_id));

  const removed = v.currentAssignments.filter((a) => !newIds.has(a.agent_id));
  const added = v.assignments.filter((a) => !currentIds.has(a.agent_id));
  const roleChanges = v.assignments.filter((a) => {
    const cur = v.currentAssignments.find((c) => c.agent_id === a.agent_id);
    return cur && cur.role !== a.role;
  });

  // Delete removed
  for (const r of removed) {
    await db
      .delete(taskAgents)
      .where(and(eq(taskAgents.taskId, v.taskId), eq(taskAgents.agentId, r.agent_id)));
  }

  // Demote old primary before promoting new one
  const oldPrimary = v.currentAssignments.find((a) => a.role === "primary");
  const newPrimary = v.assignments.find((a) => a.role === "primary");
  if (oldPrimary && newPrimary && oldPrimary.agent_id !== newPrimary.agent_id) {
    if (newIds.has(oldPrimary.agent_id)) {
      await db
        .update(taskAgents)
        .set({ role: "helper" })
        .where(and(eq(taskAgents.taskId, v.taskId), eq(taskAgents.agentId, oldPrimary.agent_id)));
    }
  }

  // Insert added
  for (const a of added) {
    await db.insert(taskAgents).values({
      taskId: v.taskId,
      agentId: a.agent_id,
      role: a.role,
    });
  }

  // Update role changes
  for (const rc of roleChanges) {
    if (oldPrimary && rc.agent_id === oldPrimary.agent_id && rc.role === "helper") continue;
    await db
      .update(taskAgents)
      .set({ role: rc.role })
      .where(and(eq(taskAgents.taskId, v.taskId), eq(taskAgents.agentId, rc.agent_id)));
  }

  // Update tasks.agent_id for backward compat
  const primaryAgent = v.assignments.find((a) => a.role === "primary");
  await db
    .update(tasks)
    .set({ agentId: primaryAgent?.agent_id ?? null })
    .where(eq(tasks.id, v.taskId));

  // Log activity
  try {
    await db.insert(activityLog).values({
      workspaceId: v.workspaceId,
      agentId: null,
      userId: user.id,
      action: "task_updated",
      details: {
        task_id: v.taskId,
        field: "agents",
        added: added.map((a) => a.agent_id),
        removed: removed.map((a) => a.agent_id),
        role_changes: roleChanges.map((a) => ({ agent_id: a.agent_id, role: a.role })),
      },
    });
  } catch {
    // best-effort
  }

  return { success: true as const };
}

// ---------------------------------------------------------------------------
// Add Task Comment
// ---------------------------------------------------------------------------

const addCommentSchema = z.object({
  taskId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  content: z.string().min(1).max(10000),
});

export async function addTaskComment(data: {
  taskId: string;
  workspaceId: string;
  content: string;
}) {
  const parsed = addCommentSchema.safeParse(data);
  if (!parsed.success) {
    return { success: false as const, error: parsed.error.issues[0].message };
  }

  let user;
  try {
    user = await requireAuth();
  } catch {
    return { success: false as const, error: "Not authenticated" };
  }

  const v = parsed.data;

  try {
    await requireWorkspaceMember(user.id, v.workspaceId);
  } catch {
    return { success: false as const, error: "Not a workspace member" };
  }

  const db = getDb();

  const [comment] = await db
    .insert(taskComments)
    .values({
      taskId: v.taskId,
      workspaceId: v.workspaceId,
      userId: user.id,
      content: v.content,
    })
    .returning({ id: taskComments.id });

  if (!comment) {
    return { success: false as const, error: "Failed to add comment" };
  }

  // Log activity (best-effort)
  try {
    await db.insert(activityLog).values({
      workspaceId: v.workspaceId,
      userId: user.id,
      action: "task_comment",
      details: { task_id: v.taskId },
    });
  } catch {
    // best-effort
  }

  return { success: true as const, commentId: comment.id };
}
