import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProblemsTable } from "@/components/problems/problems-table";

export const metadata: Metadata = { title: "Problems | Mangistew" };

export default async function ProblemsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Get workspace membership (RPC bypasses RLS cache issues)
  const { data: membership } = await supabase
    .rpc("check_user_workspace_membership" as any)
    .maybeSingle();

  if (!membership) {
    redirect("/onboarding");
  }

  const workspaceId = (membership as any).workspace_id;

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
