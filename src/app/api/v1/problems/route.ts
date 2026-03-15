import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import type { Json } from "@/lib/database.types";

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
  const supabase = createAdminClient();

  // If task_id provided, verify it exists in the agent's workspace
  if (task_id) {
    const { data: task, error: taskError } = await supabase
      .from("tasks")
      .select("id")
      .eq("id", task_id)
      .eq("workspace_id", agent.workspace_id)
      .single();

    if (taskError || !task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
  }

  const { data: problem, error: insertError } = await supabase
    .from("problems")
    .insert({
      agent_id: agent.id,
      title,
      description: description ?? null,
      severity: severity ?? "medium",
      task_id: task_id ?? null,
    })
    .select("id, severity")
    .single();

  if (insertError || !problem) {
    return NextResponse.json({ error: "Failed to report problem" }, { status: 500 });
  }

  await supabase.from("activity_log").insert({
    workspace_id: agent.workspace_id,
    agent_id: agent.id,
    action: "problem_reported",
    details: {
      problem_id: problem.id,
      title,
      severity: problem.severity,
      task_id: task_id ?? null,
    } as unknown as Json,
  });

  return NextResponse.json({ problem_id: problem.id, severity: problem.severity }, { status: 201 });
}

export const POST = withRateLimit(handlePost);
