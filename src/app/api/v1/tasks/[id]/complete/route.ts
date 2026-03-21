import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { tasks, activityLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";
import { isValidTransition } from "@/lib/task-status";
import { notifyLeadAgent } from "@/lib/task-delivery";

async function handlePost(request: NextRequest, context?: unknown) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  // Parse optional body for result
  let body: { result?: Record<string, unknown> } = {};
  try {
    body = await request.json();
  } catch {
    // Body is empty or invalid JSON — result is optional
  }

  const db = getDb();

  // Verify task exists and belongs to this workspace
  const taskRows = await db
    .select({
      id: tasks.id,
      status: tasks.status,
      projectId: tasks.projectId,
      title: tasks.title,
    })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, agent.workspaceId)))
    .limit(1);

  const task = taskRows[0];
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const currentStatus = task.status;
  if (!isValidTransition(currentStatus, "completed")) {
    return NextResponse.json(
      { error: `Cannot complete task with status '${currentStatus}'` },
      { status: 422 }
    );
  }

  // Mark task as completed with optimistic lock on current status
  const updateResult = await db
    .update(tasks)
    .set({
      status: "completed",
      result: body.result ?? null,
      agentId: agent.id,
      updatedAt: new Date(),
    })
    .where(and(eq(tasks.id, id), eq(tasks.status, currentStatus)))
    .returning({ id: tasks.id });

  if (updateResult.length === 0) {
    return NextResponse.json({ error: "Conflict: task status has changed" }, { status: 409 });
  }

  // Activity log
  await db.insert(activityLog).values({
    workspaceId: agent.workspaceId,
    agentId: agent.id,
    action: "task_completed",
    details: {
      task_id: id,
      changes: { old_status: currentStatus, new_status: "completed" },
    },
  });

  // Notify lead agent on status change
  if (task.projectId) {
    void notifyLeadAgent(task.projectId, "task.status_changed", {
      task_id: id,
      title: task.title,
      old_status: currentStatus,
      new_status: "completed",
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handlePost);
