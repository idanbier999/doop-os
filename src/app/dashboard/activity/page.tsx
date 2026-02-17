import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity/activity-timeline";

export default async function ActivityPage() {
  const supabase = await createClient();

  const [entriesResult, agentsResult, boardsResult] = await Promise.all([
    supabase
      .from("activity_log")
      .select("*, agents(name)")
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.from("agents").select("id, name").order("name"),
    supabase.from("boards").select("id, name").order("name"),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">Activity Log</h1>
      <ActivityTimeline
        initialEntries={entriesResult.data || []}
        agents={agentsResult.data || []}
        boards={boardsResult.data || []}
      />
    </div>
  );
}
