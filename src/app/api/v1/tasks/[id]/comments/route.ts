import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import type { Json } from "@/lib/database.types";

const commentBodySchema = z
  .object({
    content: z.string().min(1).max(10000),
  })
  .strict();

async function handlePost(request: NextRequest, context?: unknown) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = commentBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 422 }
    );
  }

  const { content } = parsed.data;
  const supabase = createAdminClient();

  // Verify task exists in agent's workspace
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", agent.workspace_id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  const { data: comment, error: insertError } = await supabase
    .from("task_comments")
    .insert({
      task_id: id,
      workspace_id: agent.workspace_id,
      agent_id: agent.id,
      user_id: null,
      content,
    })
    .select("id")
    .single();

  if (insertError || !comment) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }

  await supabase.from("activity_log").insert({
    workspace_id: agent.workspace_id,
    agent_id: agent.id,
    action: "task_comment",
    details: {
      task_id: id,
      comment_id: comment.id,
      content_preview: content.slice(0, 100),
    } as unknown as Json,
  });

  return NextResponse.json({ comment_id: comment.id, task_id: id }, { status: 201 });
}

export const POST = withRateLimit(handlePost);
