import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { agents, problems, tasks } from "@/lib/db/schema";
import { eq, and, ilike, inArray } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { requireWorkspaceMember } from "@/lib/db/auth";

const RESULT_LIMIT = 5;

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim();
  const workspaceId = searchParams.get("workspace");

  if (!query || !workspaceId || query.length > 200) {
    return NextResponse.json({ results: [] });
  }

  await requireWorkspaceMember(user.id, workspaceId);

  const db = getDb();
  const pattern = `%${query}%`;
  const results: Array<{
    id: string;
    type: string;
    title: string;
    subtitle?: string;
    href: string;
  }> = [];

  // Search agents
  const agentResults = await db
    .select({ id: agents.id, name: agents.name, agentType: agents.agentType })
    .from(agents)
    .where(and(eq(agents.workspaceId, workspaceId), ilike(agents.name, pattern)))
    .limit(RESULT_LIMIT);

  for (const a of agentResults) {
    results.push({
      id: a.id,
      type: "agent",
      title: a.name,
      subtitle: a.agentType ?? undefined,
      href: `/dashboard/agents/${a.id}`,
    });
  }

  // Search tasks
  const taskResults = await db
    .select({ id: tasks.id, title: tasks.title, status: tasks.status })
    .from(tasks)
    .where(and(eq(tasks.workspaceId, workspaceId), ilike(tasks.title, pattern)))
    .limit(RESULT_LIMIT);

  for (const t of taskResults) {
    results.push({
      id: t.id,
      type: "task",
      title: t.title,
      subtitle: t.status,
      href: `/dashboard/tasks`,
    });
  }

  // Search problems (via agents in workspace)
  const workspaceAgentIds = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.workspaceId, workspaceId));

  const agentIds = workspaceAgentIds.map((a) => a.id);
  if (agentIds.length > 0) {
    const problemResults = await db
      .select({ id: problems.id, title: problems.title, severity: problems.severity })
      .from(problems)
      .where(and(inArray(problems.agentId, agentIds), ilike(problems.title, pattern)))
      .limit(RESULT_LIMIT);

    for (const p of problemResults) {
      results.push({
        id: p.id,
        type: "problem",
        title: p.title,
        subtitle: p.severity,
        href: `/dashboard/problems`,
      });
    }
  }

  return NextResponse.json({ results });
}
