import type { Metadata } from "next";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { redirect } from "next/navigation";
import { ProblemsTable } from "@/components/problems/problems-table";

export const metadata: Metadata = { title: "Problems | Mangistew" };

export default async function ProblemsPage() {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const workspaceId = membership.workspace_id;

  // Fetch workspace-scoped agents first
  const agentsResult = await supabase
    .from("agents")
    .select("id, name")
    .eq("workspace_id", workspaceId);

  const agents = agentsResult.data ?? [];
  const agentIds = agents.map((a) => a.id);

  // Fetch problems scoped to workspace agents
  const problemsResult =
    agentIds.length > 0
      ? await supabase
          .from("problems")
          .select("*, agents(name, agent_type)")
          .in("agent_id", agentIds)
          .order("created_at", { ascending: false })
      : { data: [] };

  const problems = problemsResult.data ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-mac-black">Problems</h1>
        <p className="mt-1 text-sm text-mac-dark-gray">
          Issues reported by agents that need attention
        </p>
      </div>

      <ProblemsTable initialProblems={problems} agents={agents} />
    </div>
  );
}
