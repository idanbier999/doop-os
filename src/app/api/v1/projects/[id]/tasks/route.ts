import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import type { Json } from "@/lib/database.types";

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
  const supabase = createAdminClient();

  // Verify project exists in workspace
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("workspace_id", agent.workspace_id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Verify caller is lead of this project
  const { data: membership, error: memberError } = await supabase
    .from("project_agents")
    .select("role")
    .eq("project_id", projectId)
    .eq("agent_id", agent.id)
    .single();

  if (memberError || !membership || membership.role !== "lead") {
    return NextResponse.json({ error: "Only project leads can create tasks" }, { status: 403 });
  }

  // Insert task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      workspace_id: agent.workspace_id,
      project_id: projectId,
      title,
      description: description ?? null,
      priority,
      status: "pending",
      agent_id: null,
    })
    .select("id, title, status")
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Failed to create task" }, { status: 500 });
  }

  // Handle dependencies
  if (depends_on && depends_on.length > 0) {
    // Validate all dependency task IDs exist in the same project
    const { data: depTasks, error: depError } = await supabase
      .from("tasks")
      .select("id")
      .in("id", depends_on)
      .eq("project_id", projectId);

    if (depError) {
      return NextResponse.json({ error: "Failed to validate dependencies" }, { status: 500 });
    }

    const foundIds = new Set((depTasks ?? []).map((t: { id: string }) => t.id));
    const invalidIds = depends_on.filter((depId) => !foundIds.has(depId));

    if (invalidIds.length > 0) {
      return NextResponse.json(
        { error: "Invalid dependency task IDs", invalid_ids: invalidIds },
        { status: 422 }
      );
    }

    const depRows = depends_on.map((depId) => ({
      task_id: task.id,
      depends_on_task_id: depId,
    }));

    await supabase.from("task_dependencies").insert(depRows);
  }

  await supabase.from("activity_log").insert({
    workspace_id: agent.workspace_id,
    agent_id: agent.id,
    action: "task_created",
    details: {
      task_id: task.id,
      project_id: projectId,
      title,
      priority,
      depends_on: depends_on ?? [],
    } as unknown as Json,
  });

  return NextResponse.json(
    { task_id: task.id, title: task.title, status: task.status },
    { status: 201 }
  );
}

export const POST = withRateLimit(handlePost);
