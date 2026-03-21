import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { tasks, taskComments, activityLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";

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
  const db = getDb();

  // Verify task exists in agent's workspace
  const taskRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.workspaceId, agent.workspaceId)))
    .limit(1);

  if (taskRows.length === 0) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  let comment;
  try {
    const result = await db
      .insert(taskComments)
      .values({
        taskId: id,
        workspaceId: agent.workspaceId,
        agentId: agent.id,
        userId: null,
        content,
      })
      .returning({ id: taskComments.id });

    comment = result[0];
  } catch {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }

  if (!comment) {
    return NextResponse.json({ error: "Failed to add comment" }, { status: 500 });
  }

  await db.insert(activityLog).values({
    workspaceId: agent.workspaceId,
    agentId: agent.id,
    action: "task_comment",
    details: {
      task_id: id,
      comment_id: comment.id,
      content_preview: content.slice(0, 100),
    },
  });

  return NextResponse.json({ comment_id: comment.id, task_id: id }, { status: 201 });
}

export const POST = withRateLimit(handlePost);
