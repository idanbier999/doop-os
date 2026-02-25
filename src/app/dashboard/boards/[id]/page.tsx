import { notFound } from "next/navigation";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { BoardDetailClient } from "@/components/boards/board-detail-client";

interface BoardDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function BoardDetailPage({
  params,
}: BoardDetailPageProps) {
  const { id } = await params;
  const { supabase: sb } = await getAuthenticatedSupabase();
  const supabase = sb!;

  // Fetch board
  const { data: board } = await supabase
    .from("boards")
    .select("*")
    .eq("id", id)
    .single();

  if (!board) notFound();

  // Fetch tasks for this board with agent names
  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, agents(name), task_agents(agent_id, role, agents(name))")
    .eq("board_id", id)
    .order("created_at", { ascending: false });

  // Fetch problems linked to tasks on this board
  const taskIds = (tasks || []).map((t) => t.id);
  let problems: { id: string; task_id: string | null; severity: string; status: string }[] = [];
  if (taskIds.length > 0) {
    const { data } = await supabase
      .from("problems")
      .select("id, task_id, severity, status")
      .in("task_id", taskIds)
      .eq("status", "open");
    problems = data || [];
  }

  // Fetch agents for task assignment
  const { data: agents } = await supabase
    .from("agents")
    .select("id, name")
    .eq("workspace_id", board.workspace_id)
    .order("name");

  return (
    <BoardDetailClient
      board={board}
      initialTasks={tasks || []}
      initialProblems={problems}
      agents={agents || []}
    />
  );
}
