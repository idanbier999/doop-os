import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import { isValidTransition } from "@/lib/task-status";
import { deliverTaskToAgent, notifyLeadAgent } from "@/lib/task-delivery";
import type { Json } from "@/lib/database.types";

const TASK_SELECT =
  "id, title, status, project_id, agent_id, priority, description, result, updated_at" as const;

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

  const allowedFields = ["status", "agent_id", "title", "description", "priority", "result"];
  const updateFields: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in body) {
      updateFields[key] = body[key];
    }
  }

  if (Object.keys(updateFields).length === 0) {
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

  const supabase = createAdminClient();

  // Fetch current task
  const { data: currentTask, error: fetchError } = await supabase
    .from("tasks")
    .select("id, status, project_id, agent_id")
    .eq("id", id)
    .eq("workspace_id", agent.workspace_id)
    .single();

  if (fetchError || !currentTask) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const currentStatus = currentTask.status as string;
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
    const { data, error } = await supabase
      .from("tasks")
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", agent.workspace_id)
      .eq("status", currentStatus)
      .select(TASK_SELECT)
      .single();

    if (error?.code === "PGRST116") {
      return NextResponse.json({ error: "Conflict: task status has changed" }, { status: 409 });
    }

    if (error || !data) {
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    updatedTask = data;
  } else {
    // Non-status update — no lock needed
    const { data, error } = await supabase
      .from("tasks")
      .update({ ...updateFields, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("workspace_id", agent.workspace_id)
      .select(TASK_SELECT)
      .single();

    if (error) {
      return NextResponse.json({ error: "Failed to update task" }, { status: 500 });
    }

    updatedTask = data;
  }

  // Side effects
  let delivery;

  // Auto-deliver when agent_id newly set on deliverable task
  if (
    updateFields.agent_id &&
    updateFields.agent_id !== currentTask.agent_id &&
    (currentStatus === "pending" || currentStatus === "waiting_on_agent")
  ) {
    // Check for unresolved dependencies before auto-delivering
    const { data: deps } = await supabase
      .from("task_dependencies")
      .select("depends_on_task_id")
      .eq("task_id", id);

    let hasUnresolvedDeps = false;
    if (deps && deps.length > 0) {
      const depIds = deps.map((d: { depends_on_task_id: string }) => d.depends_on_task_id);
      const { data: incompleteDeps } = await supabase
        .from("tasks")
        .select("id")
        .in("id", depIds)
        .neq("status", "completed")
        .limit(1);
      hasUnresolvedDeps = !!incompleteDeps && incompleteDeps.length > 0;
    }

    if (!hasUnresolvedDeps) {
      delivery = await deliverTaskToAgent(id, updateFields.agent_id as string, agent.workspace_id);
    }
  }

  // Notify lead agent on status change
  if (hasStatusChange && currentTask.project_id) {
    void notifyLeadAgent(currentTask.project_id as string, "task.status_changed", {
      task_id: id,
      title: updatedTask.title,
      old_status: currentStatus,
      new_status: updateFields.status as string,
    });
  }

  // Activity log
  const details = hasStatusChange
    ? { task_id: id, changes: { old_status: currentStatus, new_status: updateFields.status } }
    : { task_id: id, fields_updated: Object.keys(updateFields) };

  await supabase.from("activity_log").insert({
    workspace_id: agent.workspace_id,
    agent_id: agent.id,
    action: "task_updated",
    details: details as unknown as Json,
  });

  return NextResponse.json({ task: updatedTask, delivery });
}

export const PATCH = withRateLimit(handlePatch);
