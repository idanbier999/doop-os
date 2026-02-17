import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AgentsPageClient } from "@/components/agents/agents-page-client";

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
    .select("*")
    .eq("workspace_id", membership.workspace_id)
    .order("name");

  return <AgentsPageClient initialAgents={agents || []} />;
}
