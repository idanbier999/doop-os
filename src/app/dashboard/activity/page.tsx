import type { Metadata } from "next";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { ActivityTimeline } from "@/components/activity/activity-timeline";

export const metadata: Metadata = { title: "Audit Trail | Doop" };

export default async function ActivityPage() {
  const { supabase: sb } = await getAuthenticatedSupabase();
  const supabase = sb!;

  const [entriesResult, agentsResult] = await Promise.all([
    supabase
      .from("activity_log")
      .select("id, action, details, created_at, agent_id, user_id, workspace_id, agents(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("agents").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
        Audit Trail
      </h1>
      <ActivityTimeline
        initialEntries={entriesResult.data || []}
        agents={agentsResult.data || []}
      />
    </div>
  );
}
