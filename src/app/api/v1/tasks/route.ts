import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import { deliverTaskToAgent } from "@/lib/task-delivery";
import type { Json } from "@/lib/database.types";

async function handleGet(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const status = searchParams.get("status") ?? "pending";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const assignedTo = searchParams.get("assigned_to");

  const supabase = createAdminClient();

  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, created_at")
    .eq("workspace_id", agent.workspace_id)
    .eq("status", status)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (assignedTo === "me") {
    query = query.eq("agent_id", agent.id);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json(
      { error: "Failed to fetch tasks" },
      { status: 500 }
    );
  }

  return NextResponse.json({ tasks: data });
}

async function handlePost(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // Validate required fields
  if (!body.title || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json({ error: "title is required" }, { status: 400 });
  }
  if (!body.project_id || typeof body.project_id !== "string") {
    return NextResponse.json({ error: "project_id is required" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Validate: creating agent is a project member
  const { data: creatorMembership } = await supabase
    .from("project_agents")
    .select("id")
    .eq("project_id", body.project_id)
    .eq("agent_id", agent.id)
    .single();

  if (!creatorMembership) {
    return NextResponse.json(
      { error: "Agent is not a member of this project" },
      { status: 403 }
    );
  }

  // Validate: target agent_id is a project member (if provided)
  if (body.agent_id && typeof body.agent_id === "string") {
    const { data: targetMembership } = await supabase
      .from("project_agents")
      .select("id")
      .eq("project_id", body.project_id)
      .eq("agent_id", body.agent_id)
      .single();

    if (!targetMembership) {
      return NextResponse.json(
        { error: "Target agent is not a member of this project" },
        { status: 400 }
      );
    }
  }

  // Validate: depends_on IDs exist in the same project (if provided)
  const dependsOn = Array.isArray(body.depends_on) ? body.depends_on as string[] : [];
  if (dependsOn.length > 0) {
    const { data: depTasks } = await supabase
      .from("tasks")
      .select("id")
      .in("id", dependsOn)
      .eq("project_id", body.project_id);

    if (!depTasks || depTasks.length !== dependsOn.length) {
      return NextResponse.json(
        { error: "One or more depends_on task IDs are invalid" },
        { status: 400 }
      );
    }
  }

  // Validate priority
  const validPriorities = ["low", "medium", "high", "urgent"];
  if (body.priority && !validPriorities.includes(body.priority as string)) {
    return NextResponse.json(
      { error: `Invalid priority. Must be one of: ${validPriorities.join(", ")}` },
      { status: 400 }
    );
  }

  // Insert task
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .insert({
      title: body.title as string,
      description: (body.description as string) ?? null,
      status: "pending",
      priority: (body.priority as string) ?? "medium",
      project_id: body.project_id as string,
      workspace_id: agent.workspace_id,
      created_by: agent.id,
    })
    .select("id, title, description, status, priority, project_id, created_at")
    .single();

  if (taskError || !task) {
    return NextResponse.json(
      { error: "Failed to create task" },
      { status: 500 }
    );
  }

  // Secondary inserts — await to ensure completion before response (serverless safety)
  const secondaryInserts: PromiseLike<unknown>[] = [];

  if (body.agent_id && typeof body.agent_id === "string") {
    secondaryInserts.push(
      supabase
        .from("task_agents")
        .insert({ task_id: task.id, agent_id: body.agent_id as string, role: "assignee" })
        .then()
    );
  }

  if (dependsOn.length > 0) {
    const depRows = dependsOn.map((depId) => ({
      task_id: task.id,
      depends_on_task_id: depId,
    }));
    secondaryInserts.push(
      supabase.from("task_dependencies").insert(depRows).then()
    );
  }

  secondaryInserts.push(
    supabase
      .from("activity_log")
      .insert({
        workspace_id: agent.workspace_id,
        agent_id: agent.id,
        action: "task_created_by_agent",
        details: { task_id: task.id, title: body.title, project_id: body.project_id } as unknown as Json,
      })
      .then()
  );

  const settledResults = await Promise.allSettled(secondaryInserts);
  const warnings: string[] = [];
  settledResults.forEach((result, index) => {
    if (result.status === "rejected") {
      console.warn(`Secondary insert ${index} rejected:`, result.reason);
      warnings.push(`Secondary insert failed: ${result.reason}`);
    } else if (result.status === "fulfilled") {
      const val = result.value as { error?: { message?: string } } | undefined;
      if (val?.error) {
        console.warn(`Secondary insert ${index} error:`, val.error.message);
        warnings.push(`Secondary insert error: ${val.error.message}`);
      }
    }
  });

  // Auto-delivery: if agent_id set AND no dependencies
  let delivery;
  if (body.agent_id && typeof body.agent_id === "string" && dependsOn.length === 0) {
    delivery = await deliverTaskToAgent(task.id, body.agent_id as string, agent.workspace_id);
  }

  return NextResponse.json(
    { task, delivery, ...(warnings.length > 0 && { warnings }) },
    { status: 201 }
  );
}

export const GET = withRateLimit(handleGet);
export const POST = withRateLimit(handlePost);
