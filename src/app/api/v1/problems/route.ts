import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { tasks, problems, activityLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";

const problemBodySchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    severity: z.enum(["low", "medium", "high", "critical"]).optional(),
    task_id: z.string().uuid().optional(),
  })
  .strict();

async function handlePost(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = problemBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 422 }
    );
  }

  const { title, description, severity, task_id } = parsed.data;
  const db = getDb();

  // If task_id provided, verify it exists in the agent's workspace
  if (task_id) {
    const taskRows = await db
      .select({ id: tasks.id })
      .from(tasks)
      .where(and(eq(tasks.id, task_id), eq(tasks.workspaceId, agent.workspaceId)))
      .limit(1);

    if (taskRows.length === 0) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  let problem;
  try {
    const result = await db
      .insert(problems)
      .values({
        agentId: agent.id,
        title,
        description: description ?? null,
        severity: severity ?? "medium",
        taskId: task_id ?? null,
      })
      .returning({
        id: problems.id,
        severity: problems.severity,
      });

    problem = result[0];
  } catch {
    return NextResponse.json({ error: "Failed to report problem" }, { status: 500 });
  }

  if (!problem) {
    return NextResponse.json({ error: "Failed to report problem" }, { status: 500 });
  }

  await db.insert(activityLog).values({
    workspaceId: agent.workspaceId,
    agentId: agent.id,
    action: "problem_reported",
    details: {
      problem_id: problem.id,
      title,
      severity: problem.severity,
      task_id: task_id ?? null,
    },
  });

  return NextResponse.json({ problem_id: problem.id, severity: problem.severity }, { status: 201 });
}

export const POST = withRateLimit(handlePost);
