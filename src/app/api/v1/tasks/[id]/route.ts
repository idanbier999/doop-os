import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { tasks, taskDependencies, activityLog } from "@/lib/db/schema";
import { eq, and, inArray, ne } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";
import { isValidTransition } from "@/lib/task-status";
import { deliverTaskToAgent, notifyLeadAgent } from "@/lib/task-delivery";

async function handlePatch(request: NextRequest, context?: unknown) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Map from snake_case body keys to camelCase schema fields
  const fieldMapping: Record<string, keyof typeof tasks.$inferInsert> = {
    status: "status",
    agent_id: "agentId",
    title: "title",
    description: "description",
    priority: "priority",
    result: "result",
  };

  const allowedFields = Object.keys(fieldMapping);
  const updateFields: Partial<typeof tasks.$inferInsert> = {};
  const bodyFieldsUsed: string[] = [];

  for (const key of allowedFields) {
    if (key in body) {
      const schemaKey = fieldMapping[key];
      (updateFields as Record<string, unknown>)[schemaKey] = body[key];
      bodyFieldsUsed.push(key);
    }
  }

  if (bodyFieldsUsed.length === 0) {
    return NextResponse.json({ error: "At least one field is required" }, { status: 400 });
  }

  // Validate priority
  if ("priority" in updateFields) {
    const validPriorities = ["low", "medium", "high", "urgent"];
    if (!validPriorities.includes(updateFields.priority as string)) {
      return NextResponse.json(
        { error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
        { status: 400 }
      );
    }
  }

  const db = getDb();

  // Fetch current task
  const currentTaskRows = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      projectId: tasks.projectId,
      agentId: tasks.agentId,
    })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, agent.workspaceId)))
    .limit(1);

  const currentTask = currentTaskRows[0];
  if (!currentTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const currentStatus = currentTask.status;
  const hasStatusChange = "status" in updateFields;

  let updatedTask;

  if (hasStatusChange) {
    const targetStatus = updateFields.status as string;

    if (!isValidTransition(currentStatus, targetStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition from ${currentStatus} to ${targetStatus}`,
        },
        { status: 422 }
      );
    }

    // Update with optimistic lock on current status
    const result = await db
      .update(tasks)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(
        and(
          eq(tasks.id, id),
          eq(tasks.workspaceId, agent.workspaceId),
          eq(tasks.status, currentStatus)
        )
      )
      .returning({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        project_id: tasks.projectId,
        agent_id: tasks.agentId,
        priority: tasks.priority,
        description: tasks.description,
        result: tasks.result,
        updated_at: tasks.updatedAt,
      });

    if (result.length === 0) {
      return NextResponse.json({ error: "Conflict: task status has changed" }, { status: 409 });
    }

    updatedTask = result[0];
  } else {
    // Non-status update — no lock needed
    const result = await db
      .update(tasks)
      .set({ ...updateFields, updatedAt: new Date() })
      .where(and(eq(tasks.id, id), eq(tasks.workspaceId, agent.workspaceId)))
      .returning({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
        project_id: tasks.projectId,
        agent_id: tasks.agentId,
        priority: tasks.priority,
        description: tasks.description,
        result: tasks.result,
        updated_at: tasks.updatedAt,
      });

    if (result.length === 0) {
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    updatedTask = result[0];
  }

  // Side effects
  let delivery;

  // Auto-deliver when agent_id newly set on deliverable task
  if (
    updateFields.agentId &&
    updateFields.agentId !== currentTask.agentId &&
    (currentStatus === "pending" || currentStatus === "waiting_on_agent")
  ) {
    // Check for unresolved dependencies before auto-delivering
    const deps = await db
      .select({ dependsOnTaskId: taskDependencies.dependsOnTaskId })
      .from(taskDependencies)
      .where(eq(taskDependencies.taskId, id));

    let hasUnresolvedDeps = false;
    if (deps.length > 0) {
      const depIds = deps.map((d) => d.dependsOnTaskId);
      const incompleteDeps = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(inArray(tasks.id, depIds), ne(tasks.status, "completed")))
        .limit(1);
      hasUnresolvedDeps = incompleteDeps.length > 0;
    }

    if (!hasUnresolvedDeps) {
      delivery = await deliverTaskToAgent(id, updateFields.agentId as string, agent.workspaceId);
    }
  }

  // Notify lead agent on status change
  if (hasStatusChange && currentTask.projectId) {
    void notifyLeadAgent(currentTask.projectId, "task.status_changed", {
      task_id: id,
      title: updatedTask.title,
      old_status: currentStatus,
      new_status: updateFields.status as string,
    });
  }

  // Activity log
  const details = hasStatusChange
    ? { task_id: id, changes: { old_status: currentStatus, new_status: updateFields.status } }
    : { task_id: id, fields_updated: bodyFieldsUsed };

  await db.insert(activityLog).values({
    workspaceId: agent.workspaceId,
    agentId: agent.id,
    action: "task_updated",
    details,
  });

  return NextResponse.json({ task: updatedTask, delivery });
}

export const PATCH = withRateLimit(handlePatch);
