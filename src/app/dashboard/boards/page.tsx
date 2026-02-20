import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { BoardsPageClient } from "@/components/boards/boards-page-client";

export const metadata: Metadata = { title: "Boards | Mangistew" };

export default async function BoardsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) redirect("/onboarding");

  const workspaceId = membership.workspace_id;

  const [boardsResult, tasksResult] = await Promise.all([
    supabase
      .from("boards")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("position"),
    supabase
      .from("tasks")
      .select("id, board_id, status, agent_id")
      .eq("workspace_id", workspaceId),
  ]);

  return (
    <BoardsPageClient
      initialBoards={boardsResult.data || []}
      initialTasks={tasksResult.data || []}
    />
  );
}
