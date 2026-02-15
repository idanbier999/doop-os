"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";
import { TaskCard } from "./task-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";

type Task = Tables<"tasks"> & { agents?: { name: string } | null };

const COLUMNS = [
  { key: "pending", label: "Pending" },
  { key: "in_progress", label: "In Progress" },
  { key: "waiting_on_agent", label: "Waiting on Agent" },
  { key: "waiting_on_human", label: "Waiting on Human" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

interface TaskBoardProps {
  initialTasks: Task[];
}

export function TaskBoard({ initialTasks }: TaskBoardProps) {
  const { workspaceId } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handlePayload = useCallback(
    (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
      if (payload.eventType === "INSERT") {
        const newTask = payload.new as unknown as Task;
        if (newTask.workspace_id === workspaceId) {
          setTasks((prev) => [newTask, ...prev]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as Task;
        setTasks((prev) =>
          prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as { id: string };
        setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      }
    },
    [workspaceId]
  );

  useRealtime({
    table: "tasks",
    filter: `workspace_id=eq.${workspaceId}`,
    onPayload: handlePayload,
  });

  const grouped = COLUMNS.map((col) => ({
    ...col,
    tasks: tasks.filter((t) => t.status === col.key),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {grouped.map((col) => (
        <div
          key={col.key}
          className="flex-shrink-0 w-72"
        >
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-medium text-gray-400">
              {col.label}
            </h3>
            <span className="text-xs text-gray-600 bg-gray-800 rounded-full px-2 py-0.5">
              {col.tasks.length}
            </span>
          </div>
          <div className="space-y-2 min-h-[200px]">
            {col.tasks.length === 0 ? (
              <div className="rounded-md border border-dashed border-gray-800 p-4 text-center text-xs text-gray-600">
                No tasks
              </div>
            ) : (
              col.tasks.map((task) => (
                <TaskCard key={task.id} task={task} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
