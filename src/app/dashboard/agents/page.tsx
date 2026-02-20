import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getAgentStatsMap } from "@/lib/agent-stats";
import { AgentsPageClient } from "@/components/agents/agents-page-client";

export const metadata: Metadata = { title: "Agents | Mangistew" };

export default async function AgentsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, health, stage, agent_type, last_seen_at, workspace_id, tags, description, metadata, platform, created_at, updated_at")
    .eq("workspace_id", membership.workspace_id)
    .order("name");

  const agentList = agents || [];
  const agentIds = agentList.map((a) => a.id);
  const statsMap = await getAgentStatsMap(supabase, agentIds);

  // Convert Map to plain object for serialization to client component
  const statsRecord: Record<string, { completionRate: number; openProblems: number }> = {};
  for (const [id, stats] of statsMap) {
    statsRecord[id] = stats;
  }

  return <AgentsPageClient initialAgents={agentList} agentStats={statsRecord} />;
}
