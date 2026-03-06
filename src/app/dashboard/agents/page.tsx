import type { Metadata } from "next";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { redirect } from "next/navigation";
import { getAgentStatsMap } from "@/lib/agent-stats";
import { AgentsPageClient } from "@/components/agents/agents-page-client";
import { getWorkspaceMemberMap } from "@/lib/workspace-members";

export const metadata: Metadata = { title: "Agents | Tarely" };

export default async function AgentsPage() {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name, health, stage, agent_type, last_seen_at, workspace_id, tags, description, metadata, platform, created_at, updated_at, capabilities, webhook_url, webhook_secret, owner_id")
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

  const memberMap = await getWorkspaceMemberMap(supabase, membership.workspace_id);

  const ownerNames: Record<string, string> = {};
  for (const a of agentList) {
    if (a.owner_id) {
      const member = memberMap.get(a.owner_id);
      if (member) ownerNames[a.id] = member.name;
    }
  }

  return <AgentsPageClient initialAgents={agentList} agentStats={statsRecord} ownerNames={ownerNames} />;
}
