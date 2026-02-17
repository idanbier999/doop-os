"use client";

import { useState, useMemo } from "react";
import { BoardHeader } from "./board-header";
import { BoardKanban } from "./board-kanban";
import { BoardListView } from "./board-list-view";
import { BoardViewToggle } from "./board-view-toggle";
import { BoardFilters } from "./board-filters";
import { CreateTaskForm } from "@/components/tasks/create-task-form";
import { TaskDetailDrawer } from "@/components/tasks/task-detail-drawer";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";

type Task = Tables<"tasks"> & { agents?: { name: string } | null };

interface BoardDetailClientProps {
  board: Tables<"boards">;
  initialTasks: Task[];
  initialProblems: {
    id: string;
    task_id: string | null;
    severity: string;
    status: string;
  }[];
  agents: { id: string; name: string }[];
}

export function BoardDetailClient({
  board,
  initialTasks,
  initialProblems,
  agents,
}: BoardDetailClientProps) {
  const [view, setView] = useState<"board" | "list">("board");
  const [filters, setFilters] = useState({
    status: "",
    priority: "",
    agentId: "",
    dateFrom: "",
    dateTo: "",
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);

  const problemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of initialProblems) {
      if (p.task_id) {
        counts[p.task_id] = (counts[p.task_id] || 0) + 1;
      }
    }
    return counts;
  }, [initialProblems]);

  const completedCount = initialTasks.filter(
    (t) => t.status === "completed"
  ).length;

  const activeAgentIds = new Set(
    initialTasks
      .filter(
        (t) => t.agent_id && t.status !== "completed" && t.status !== "cancelled"
      )
      .map((t) => t.agent_id)
  );

  return (
    <div className="space-y-5">
      <BoardHeader
        board={board}
        taskCount={initialTasks.length}
        completedCount={completedCount}
        activeAgentCount={activeAgentIds.size}
      />

      {/* Controls row */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <BoardViewToggle view={view} onChange={setView} />
        <Button onClick={() => setCreateOpen(true)} size="sm">
          + New Task
        </Button>
      </div>

      {/* Filters */}
      <BoardFilters
        agents={agents}
        filters={filters}
        onFiltersChange={setFilters}
      />

      {/* Main content */}
      {view === "board" ? (
        <BoardKanban
          initialTasks={initialTasks}
          boardId={board.id}
          problemCounts={problemCounts}
          filters={filters}
          onTaskClick={setSelectedTask}
        />
      ) : (
        <BoardListView
          initialTasks={initialTasks}
          boardId={board.id}
          problemCounts={problemCounts}
          filters={filters}
          onTaskClick={setSelectedTask}
        />
      )}

      {/* Create task modal */}
      <CreateTaskForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agents={agents}
        boardId={board.id}
      />

      {/* Task detail drawer */}
      <TaskDetailDrawer
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => setSelectedTask(null)}
      />
    </div>
  );
}
