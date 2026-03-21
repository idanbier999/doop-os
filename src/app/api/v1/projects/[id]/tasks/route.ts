import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { tasks, projects, projectAgents, taskDependencies, activityLog } from "@/lib/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";

const createTaskBodySchema = z
  .object({
    title: z.string().min(1).max(500),
    description: z.string().max(5000).optional(),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    depends_on: z.array(z.string().uuid()).optional(),
  })
  .strict();

async function handlePost(request: NextRequest, context?: unknown) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id: projectId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createTaskBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 422 }
    );
  }

  const { title, description, priority, depends_on } = parsed.data;
  const db = getDb();

  // Verify project exists in workspace
  const projectRows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.workspaceId, agent.workspaceId)))
    .limit(1);

  if (projectRows.length === 0) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify caller is lead of this project
  const membershipRows = await db
    .select({ role: projectAgents.role })
    .from(projectAgents)
    .where(and(eq(projectAgents.projectId, projectId), eq(projectAgents.agentId, agent.id)))
    .limit(1);

  const membership = membershipRows[0];
  if (!membership || membership.role !== "lead") {
    return NextResponse.json({ error: "Only project leads can create tasks" }, { status: 403 });
  }

  // Insert task
  let task;
  try {
    const result = await db
      .insert(tasks)
      .values({
        workspaceId: agent.workspaceId,
        projectId,
        title,
        description: description ?? null,
        priority,
        status: "pending",
        agentId: null,
      })
      .returning({
        id: tasks.id,
        title: tasks.title,
        status: tasks.status,
      });

    task = result[0];
  } catch {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  if (!task) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  // Handle dependencies
  if (depends_on && depends_on.length > 0) {
    // Validate all dependency task IDs exist in the same project
    let depTasks;
    try {
      depTasks = await db
        .select({ id: tasks.id })
        .from(tasks)
        .where(and(inArray(tasks.id, depends_on), eq(tasks.projectId, projectId)));
    } catch {
      return NextResponse.json({ error: "Failed to validate dependencies" }, { status: 500 });
    }

    const foundIds = new Set(depTasks.map((t) => t.id));
    const invalidIds = depends_on.filter((depId) => !foundIds.has(depId));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Invalid dependency task IDs", invalid_ids: invalidIds },
        { status: 422 }
      );
    }

    const depRows = depends_on.map((depId) => ({
      taskId: task.id,
      dependsOnTaskId: depId,
    }));

    await db.insert(taskDependencies).values(depRows);
  }

  await db.insert(activityLog).values({
    workspaceId: agent.workspaceId,
    agentId: agent.id,
    action: "task_created",
    details: {
      task_id: task.id,
      project_id: projectId,
      title,
      priority,
      depends_on: depends_on ?? [],
    },
  });

  return NextResponse.json(
    { task_id: task.id, title: task.title, status: task.status },
    { status: 201 }
  );
}

export const POST = withRateLimit(handlePost);
