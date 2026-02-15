"use client";

import { useState } from "react";
import { TaskBoard } from "./task-board";
import { TaskList } from "./task-list";
import { TaskViewToggle } from "./task-view-toggle";
import { CreateTaskForm } from "./create-task-form";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";

type Task = Tables<"tasks"> & { agents?: { name: string } | null };

interface TasksPageClientProps {
  initialTasks: Task[];
  agents: { id: string; name: string }[];
}

export function TasksPageClient({ initialTasks, agents }: TasksPageClientProps) {
  const [view, setView] = useState<"board" | "list">("board");
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-100">Tasks</h1>
        <div className="flex items-center gap-3">
          <TaskViewToggle view={view} onViewChange={setView} />
          <Button onClick={() => setCreateOpen(true)}>
            <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Create Task
          </Button>
        </div>
      </div>

      {view === "board" ? (
        <TaskBoard initialTasks={initialTasks} />
      ) : (
        <TaskList initialTasks={initialTasks} />
      )}

      <CreateTaskForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        agents={agents}
      />
    </div>
  );
}
