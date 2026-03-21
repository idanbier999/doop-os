import type { Metadata } from "next";
import { requireWorkspaceMembership } from "@/lib/workspace";
import { getDb } from "@/lib/db/client";
import { agents as agentsTable, problems as problemsTable } from "@/lib/db/schema";
import { eq, inArray, desc } from "drizzle-orm";
import { ProblemsTable } from "@/components/problems/problems-table";

export const metadata: Metadata = { title: "Problems | Doop" };

export default async function ProblemsPage() {
  const { workspace } = await requireWorkspaceMembership();
  const workspaceId = workspace.id;

  const db = getDb();

  // Fetch workspace-scoped agents
  const agentRows = await db
    .select({ id: agentsTable.id, name: agentsTable.name })
    .from(agentsTable)
    .where(eq(agentsTable.workspaceId, workspaceId));

  const agentIds = agentRows.map((a) => a.id);

  // Fetch problems scoped to workspace agents, with agent info
  const problemRows =
    agentIds.length > 0
      ? await db
          .select({
            problem: problemsTable,
            agentName: agentsTable.name,
            agentType: agentsTable.agentType,
          })
          .from(problemsTable)
          .innerJoin(agentsTable, eq(problemsTable.agentId, agentsTable.id))
          .where(inArray(problemsTable.agentId, agentIds))
          .orderBy(desc(problemsTable.createdAt))
      : [];

  // Merge problem data with nested agents object matching old shape
  const serializedProblems = problemRows.map((row) => ({
    ...row.problem,
    agents: {
      name: row.agentName,
      agent_type: row.agentType,
    },
  }));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mac-black">Problems</h1>
        <p className="mt-1 text-sm text-mac-dark-gray">
          Issues reported by agents that need attention
        </p>
      </div>

      {/* @ts-expect-error -- component expects snake_case fields; we pass camelCase from Drizzle + nested agents */}
      <ProblemsTable initialProblems={serializedProblems} agents={agentRows} />
    </div>
  );
}
