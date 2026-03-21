import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { tasks, taskAgents } from "@/lib/db/schema";
import { eq, and, inArray, asc } from "drizzle-orm";
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

  const db = getDb();

  // Support comma-separated status values
  const statusList = statusParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  if (assignedTo === "me") {
    // Query via task_agents junction table to include role
    let assignments;
    try {
      assignments = await db
        .select({ taskId: taskAgents.taskId, role: taskAgents.role })
        .from(taskAgents)
        .where(eq(taskAgents.agentId, agent.id));
    } catch {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }

    if (!assignments || assignments.length === 0) {
      return NextResponse.json({ tasks: [] });
    }

    const taskIds = assignments.map((a) => a.taskId);
    const roleMap = new Map(assignments.map((a) => [a.taskId, a.role]));

    try {
      const statusCondition =
        statusList.length === 1
          ? eq(tasks.status, statusList[0])
          : inArray(tasks.status, statusList);

      const result = await db
        .select({
          id: tasks.id,
          title: tasks.title,
          description: tasks.description,
          status: tasks.status,
          priority: tasks.priority,
          created_at: tasks.createdAt,
        })
        .from(tasks)
        .where(
          and(eq(tasks.workspaceId, agent.workspaceId), inArray(tasks.id, taskIds), statusCondition)
        )
        .orderBy(asc(tasks.createdAt))
        .limit(limit);

      const tasksWithRole = result.map((t) => ({
        ...t,
        role: roleMap.get(t.id) ?? null,
      }));

      return NextResponse.json({ tasks: tasksWithRole });
    } catch {
      return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
    }
  }

  // Default: query tasks table directly (backward compat)
  try {
    const statusCondition =
      statusList.length === 1 ? eq(tasks.status, statusList[0]) : inArray(tasks.status, statusList);

    const data = await db
      .select({
        id: tasks.id,
        title: tasks.title,
        description: tasks.description,
        status: tasks.status,
        priority: tasks.priority,
        created_at: tasks.createdAt,
      })
      .from(tasks)
      .where(and(eq(tasks.workspaceId, agent.workspaceId), statusCondition))
      .orderBy(asc(tasks.createdAt))
      .limit(limit);

    return NextResponse.json({ tasks: data });
  } catch {
    return NextResponse.json({ error: "Failed to fetch tasks" }, { status: 500 });
  }
}

export const GET = withRateLimit(handleGet);
