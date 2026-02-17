"use client";

import { useState, useCallback, useMemo } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";
import { BoardCard } from "./board-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type TaskSlice = Pick<Tables<"tasks">, "id" | "board_id" | "status" | "agent_id">;

interface BoardsGridProps {
  initialBoards: Tables<"boards">[];
  initialTasks: TaskSlice[];
  onCreateBoard: () => void;
}

export function BoardsGrid({
  initialBoards,
  initialTasks,
  onCreateBoard,
}: BoardsGridProps) {
  const [boards, setBoards] = useState<Tables<"boards">[]>(initialBoards);
  const [tasks, setTasks] = useState<TaskSlice[]>(initialTasks);
  const { workspaceId } = useWorkspace();

  // Realtime: boards
  const handleBoardPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newBoard = payload.new as Tables<"boards">;
        if (newBoard.workspace_id === workspaceId) {
          setBoards((prev) => [...prev, newBoard]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Tables<"boards">;
        setBoards((prev) =>
          prev.map((b) => (b.id === updated.id ? updated : b))
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as { id?: string };
        if (deleted.id) {
          setBoards((prev) => prev.filter((b) => b.id !== deleted.id));
        }
      }
    },
    [workspaceId]
  );

  // Realtime: tasks (for stats)
  const handleTaskPayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newTask = payload.new as TaskSlice;
        setTasks((prev) => [...prev, newTask]);
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as TaskSlice;
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? updated : t))
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as { id?: string };
        if (deleted.id) {
          setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
        }
      }
    },
    []
  );

  useRealtime({
    table: "boards",
    filter: `workspace_id=eq.${workspaceId}`,
    onPayload: handleBoardPayload,
  });

  useRealtime({
    table: "tasks",
    filter: `workspace_id=eq.${workspaceId}`,
    onPayload: handleTaskPayload,
  });

  // Compute per-board stats
  const boardStats = useMemo(() => {
    const stats: Record<
      string,
      { taskCount: number; completedCount: number; activeAgentIds: Set<string> }
    > = {};

    for (const board of boards) {
      stats[board.id] = { taskCount: 0, completedCount: 0, activeAgentIds: new Set() };
    }

    let unassignedCount = 0;

    for (const task of tasks) {
      if (task.board_id && stats[task.board_id]) {
        stats[task.board_id].taskCount++;
        if (task.status === "completed") {
          stats[task.board_id].completedCount++;
        }
        if (task.agent_id && task.status !== "completed") {
          stats[task.board_id].activeAgentIds.add(task.agent_id);
        }
      } else {
        unassignedCount++;
      }
    }

    return { perBoard: stats, unassignedCount };
  }, [boards, tasks]);

  if (boards.length === 0) {
    return (
      <EmptyState
        message="No boards yet"
        description="Create your first board to organize agent work"
        actionLabel="Create Board"
        onAction={onCreateBoard}
      />
    );
  }

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {boards.map((board) => {
          const stats = boardStats.perBoard[board.id];
          return (
            <BoardCard
              key={board.id}
              board={board}
              taskCount={stats?.taskCount ?? 0}
              completedCount={stats?.completedCount ?? 0}
              activeAgentCount={stats?.activeAgentIds.size ?? 0}
            />
          );
        })}
      </div>
      {boardStats.unassignedCount > 0 && (
        <p className="mt-3 text-xs text-mac-dark-gray font-[family-name:var(--font-pixel)]">
          {boardStats.unassignedCount} unassigned task{boardStats.unassignedCount !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
