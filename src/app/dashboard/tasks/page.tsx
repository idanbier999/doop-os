import { createClient } from "@/lib/supabase/server";
import { TasksPageClient } from "@/components/tasks/tasks-page-client";

export default async function TasksPage() {
  const supabase = await createClient();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, agents(name)")
    .order("created_at", { ascending: false });

  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .order("name");

  return (
    <TasksPageClient
      initialTasks={tasks || []}
      agents={agents || []}
    />
  );
}
