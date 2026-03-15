import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import { isValidTransition } from "@/lib/task-status";
import { notifyLeadAgent } from "@/lib/task-delivery";
import type { Json } from "@/lib/database.types";

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

  const supabase = createAdminClient();

  // Verify task exists and belongs to this workspace
  const { data: task, error: fetchError } = await supabase
    .from("tasks")
    .select("id, status, project_id, title")
    .eq("id", id)
    .eq("workspace_id", agent.workspace_id)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const currentStatus = task.status as string;
  if (!isValidTransition(currentStatus, "completed")) {
    return NextResponse.json(
      { error: `Cannot complete task with status '${currentStatus}'` },
      { status: 422 }
    );
  }

  // Mark task as completed with optimistic lock on current status
  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      result: (body.result as Json) ?? null,
      agent_id: agent.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .eq("status", currentStatus);

  if (updateError?.code === "PGRST116") {
    return NextResponse.json({ error: "Conflict: task status has changed" }, { status: 409 });
  }

  if (updateError) {
    return NextResponse.json({ error: "Failed to complete task" }, { status: 500 });
  }

  // Activity log
  await supabase.from("activity_log").insert({
    workspace_id: agent.workspace_id,
    agent_id: agent.id,
    action: "task_completed",
    details: {
      task_id: id,
      changes: { old_status: currentStatus, new_status: "completed" },
    } as unknown as Json,
  });

  // Notify lead agent on status change
  if (task.project_id) {
    void notifyLeadAgent(task.project_id as string, "task.status_changed", {
      task_id: id,
      title: task.title,
      old_status: currentStatus,
      new_status: "completed",
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handlePost);
