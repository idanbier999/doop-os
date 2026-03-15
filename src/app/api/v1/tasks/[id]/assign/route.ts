import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import type { Json } from "@/lib/database.types";

const assignBodySchema = z
  .object({
    agent_id: z.string().uuid(),
    role: z.enum(["primary", "helper"]),
  })
  .strict();

async function handlePost(request: NextRequest, context?: unknown) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { params } = context as { params: Promise<{ id: string }> };
  const { id: taskId } = await params;

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = assignBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 422 }
    );
  }

  const { agent_id: targetAgentId, role } = parsed.data;
  const supabase = createAdminClient();

  // Verify task exists and has a project
  const { data: task, error: taskError } = await supabase
    .from("tasks")
    .select("id, project_id")
    .eq("id", taskId)
    .eq("workspace_id", agent.workspace_id)
    .single();

  if (taskError || !task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!task.project_id) {
    return NextResponse.json(
      { error: "Task must belong to a project to assign agents" },
      { status: 422 }
    );
  }

  // Verify caller is lead of the task's project
  const { data: callerMembership, error: callerError } = await supabase
    .from("project_agents")
    .select("role")
    .eq("project_id", task.project_id)
    .eq("agent_id", agent.id)
    .single();

  if (callerError || !callerMembership || callerMembership.role !== "lead") {
    return NextResponse.json(
      { error: "Only project leads can assign agents to tasks" },
      { status: 403 }
    );
  }

  // Verify target agent is a member of the same project
  const { data: targetMembership, error: targetError } = await supabase
    .from("project_agents")
    .select("agent_id")
    .eq("project_id", task.project_id)
    .eq("agent_id", targetAgentId)
    .single();

  if (targetError || !targetMembership) {
    return NextResponse.json(
      { error: "Target agent is not a member of this project" },
      { status: 422 }
    );
  }

  // Upsert into task_agents: check existing, update or insert
  const { data: existing } = await supabase
    .from("task_agents")
    .select("id")
    .eq("task_id", taskId)
    .eq("agent_id", targetAgentId)
    .maybeSingle();

  if (existing) {
    const { error: updateError } = await supabase
      .from("task_agents")
      .update({ role })
      .eq("task_id", taskId)
      .eq("agent_id", targetAgentId);

    if (updateError) {
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }
  } else {
    const { error: insertError } = await supabase.from("task_agents").insert({
      task_id: taskId,
      agent_id: targetAgentId,
      role,
    });

    if (insertError) {
      return NextResponse.json({ error: "Failed to assign agent" }, { status: 500 });
    }
  }

  await supabase.from("activity_log").insert({
    workspace_id: agent.workspace_id,
    agent_id: agent.id,
    action: "task_agent_assigned",
    details: {
      task_id: taskId,
      assigned_agent_id: targetAgentId,
      role,
    } as unknown as Json,
  });

  return NextResponse.json({ task_id: taskId, agent_id: targetAgentId, role });
}

export const POST = withRateLimit(handlePost);
