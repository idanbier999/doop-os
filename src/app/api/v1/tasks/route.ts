import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";

async function handleGet(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const statusParam = searchParams.get("status") ?? "pending";
  const limit = Math.min(Number(searchParams.get("limit")) || 20, 100);
  const assignedTo = searchParams.get("assigned_to");

  const supabase = createAdminClient();

  // Support comma-separated status values
  const statusList = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (assignedTo === "me") {
    // Query via task_agents junction table to include role
    const { data: assignments, error: assignError } = await supabase
      .from("task_agents")
      .select("task_id, role")
      .eq("agent_id", agent.id);

    if (assignError) {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    const taskIds = assignments.map((a: { task_id: string }) => a.task_id);
    const roleMap = new Map(
      assignments.map((a: { task_id: string; role: string }) => [a.task_id, a.role])
    );

    let taskQuery = supabase
      .from("tasks")
      .select("id, title, description, status, priority, created_at")
      .eq("workspace_id", agent.workspace_id)
      .in("id", taskIds)
      .order("created_at", { ascending: true })
      .limit(limit);

    if (statusList.length === 1) {
      taskQuery = taskQuery.eq("status", statusList[0]);
    } else {
      taskQuery = taskQuery.in("status", statusList);
    }

    const { data: tasks, error: taskError } = await taskQuery;

    if (taskError) {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    const tasksWithRole = (tasks ?? []).map((t: { id: string }) => ({
      ...t,
      role: roleMap.get(t.id) ?? null,
    }));

    return NextResponse.json({ tasks: tasksWithRole });
  }

  // Default: query tasks table directly (backward compat)
  let query = supabase
    .from("tasks")
    .select("id, title, description, status, priority, created_at")
    .eq("workspace_id", agent.workspace_id)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (statusList.length === 1) {
    query = query.eq("status", statusList[0]);
  } else {
    query = query.in("status", statusList);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }

  return NextResponse.json({ tasks: data });
}

export const GET = withRateLimit(handleGet);
