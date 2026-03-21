import type { Metadata } from "next";
import { requireWorkspaceMembership } from "@/lib/workspace";
import { getAgentStatsMap } from "@/lib/agent-stats";
import * as agentsRepo from "@/lib/db/repos/agents";
import { AgentsPageClient } from "@/components/agents/agents-page-client";

export const metadata: Metadata = { title: "Agents | Doop" };

export default async function AgentsPage() {
  const { workspace } = await requireWorkspaceMembership();

  const agentList = await agentsRepo.findByWorkspace(workspace.id);
  const agentIds = agentList.map((a) => a.id);
  const statsMap = await getAgentStatsMap(agentIds);

  // Convert Map to plain object for serialization to client component
  const statsRecord: Record<string, { completionRate: number; openProblems: number }> = {};
  for (const [id, stats] of statsMap) {
    statsRecord[id] = stats;
  }

  return <AgentsPageClient initialAgents={agentList} agentStats={statsRecord} />;
}
