import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { tasks, projectAgents, taskAgents, activityLog } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";

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
  const db = getDb();

  // Verify task exists and has a project
  const taskRows = await db
    .select({ id: tasks.id, projectId: tasks.projectId })
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.workspaceId, agent.workspaceId)))
    .limit(1);

  const task = taskRows[0];
  if (!task) {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }

  if (!task.projectId) {
    return NextResponse.json(
      { error: "Task must belong to a project to assign agents" },
      { status: 422 }
    );
  }

  // Verify caller is lead of the task's project
  const callerMembershipRows = await db
    .select({ role: projectAgents.role })
    .from(projectAgents)
    .where(and(eq(projectAgents.projectId, task.projectId), eq(projectAgents.agentId, agent.id)))
    .limit(1);

  const callerMembership = callerMembershipRows[0];
  if (!callerMembership || callerMembership.role !== "lead") {
    return NextResponse.json(
      { error: "Only project leads can assign agents to tasks" },
      { status: 403 }
    );
  }

  // Verify target agent is a member of the same project
  const targetMembershipRows = await db
    .select({ agentId: projectAgents.agentId })
    .from(projectAgents)
    .where(
      and(eq(projectAgents.projectId, task.projectId), eq(projectAgents.agentId, targetAgentId))
    )
    .limit(1);

  if (targetMembershipRows.length === 0) {
    return NextResponse.json(
      { error: "Target agent is not a member of this project" },
      { status: 422 }
    );
  }

  // Upsert into task_agents: check existing, update or insert
  const existingRows = await db
    .select({ id: taskAgents.id })
    .from(taskAgents)
    .where(and(eq(taskAgents.taskId, taskId), eq(taskAgents.agentId, targetAgentId)))
    .limit(1);

  if (existingRows.length > 0) {
    try {
      await db
        .update(taskAgents)
        .set({ role })
        .where(and(eq(taskAgents.taskId, taskId), eq(taskAgents.agentId, targetAgentId)));
    } catch {
      return NextResponse.json({ error: "Failed to update assignment" }, { status: 500 });
    }
  } else {
    try {
      await db.insert(taskAgents).values({
        taskId,
        agentId: targetAgentId,
        role,
      });
    } catch {
      return NextResponse.json({ error: "Failed to assign agent" }, { status: 500 });
    }
  }

  await db.insert(activityLog).values({
    workspaceId: agent.workspaceId,
    agentId: agent.id,
    action: "task_agent_assigned",
    details: {
      task_id: taskId,
      assigned_agent_id: targetAgentId,
      role,
    },
  });

  return NextResponse.json({ task_id: taskId, agent_id: targetAgentId, role });
}

export const POST = withRateLimit(handlePost);
