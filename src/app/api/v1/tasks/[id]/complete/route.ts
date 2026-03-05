import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import { notifyLeadAgent } from "@/lib/task-delivery";
import type { Json } from "@/lib/database.types";

async function handlePost(
  request: NextRequest,
  context?: unknown
) {
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
    .select("id, title, project_id")
    .eq("id", id)
    .eq("workspace_id", agent.workspace_id)
    .single();

  if (fetchError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  // Mark task as completed (optimistic lock: only non-terminal statuses)
  const { error: updateError } = await supabase
    .from("tasks")
    .update({
      status: "completed",
      result: (body.result as Json) ?? null,
      agent_id: agent.id,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .in("status", ["pending", "in_progress", "waiting_on_agent", "waiting_on_human"])
    .select("id")
    .single();

  if (updateError?.code === "PGRST116") {
    return NextResponse.json(
      { error: "Task is already completed or cancelled" },
      { status: 409 }
    );
  }

  if (updateError) {
    return NextResponse.json(
      { error: "Failed to complete task" },
      { status: 500 }
    );
  }

  // Notify lead agent — fire-and-forget
  if (task.project_id) {
    void notifyLeadAgent(task.project_id, "task.completed", {
      task_id: task.id,
      title: task.title,
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handlePost);
