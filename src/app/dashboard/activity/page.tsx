import { createClient } from "@/lib/supabase/server";
import { ActivityTimeline } from "@/components/activity/activity-timeline";

export default async function ActivityPage() {
  const supabase = await createClient();

  const { data: entries } = await supabase
    .from("activity_log")
    .select("*, agents(name)")
    .order("created_at", { ascending: false })
    .limit(200);

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .order("name");

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-100">Activity Log</h1>
      <ActivityTimeline
        initialEntries={entries || []}
        agents={agents || []}
      />
    </div>
  );
}
