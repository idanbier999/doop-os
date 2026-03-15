"use client";

import { useState, useCallback, useMemo } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useSupabase } from "@/hooks/use-supabase";
import { TaskCard } from "@/components/tasks/task-card";
import type { TaskWithAgents } from "@/lib/types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const COLUMNS = [
  { key: "pending", label: "Pending", color: "#666666" },
  { key: "in_progress", label: "In Progress", color: "#0055CC" },
  { key: "waiting_on_agent", label: "Waiting on Agent", color: "#7722AA" },
  { key: "waiting_on_human", label: "Waiting on Human", color: "#AA7700" },
  { key: "completed", label: "Completed", color: "#007700" },
  { key: "cancelled", label: "Cancelled", color: "#666666" },
] as const;

interface ProjectKanbanProps {
  initialTasks: TaskWithAgents[];
  projectId: string;
  problemCounts: Record<string, number>;
  filters: { status: string; priority: string; agentId: string };
  onTaskClick: (task: TaskWithAgents) => void;
}

export function ProjectKanban({
  initialTasks,
  projectId,
  problemCounts,
  filters,
  onTaskClick,
}: ProjectKanbanProps) {
  const supabase = useSupabase();
  const [tasks, setTasks] = useState<TaskWithAgents[]>(initialTasks);

  const handlePayload = useCallback(
    async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const raw = payload.new as { id: string; project_id: string };
        if (raw.project_id !== projectId) return;
        // Re-fetch with join so task_agents enrichment is included
        const { data } = await supabase
          .from("tasks")
          .select("*, task_agents(agent_id, role, agents(name))")
          .eq("id", raw.id)
          .single();
        if (data) {
          setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === data.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = data as TaskWithAgents;
              return next;
            }
            return [data as TaskWithAgents, ...prev];
          });
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as { id: string; project_id: string };
        if (updated.project_id === projectId) {
          // Preserve task_agents — realtime payloads don't include joined data
          setTasks((prev) =>
            prev.map((t) =>
              t.id === updated.id
                ? { ...t, ...(updated as Partial<TaskWithAgents>), task_agents: t.task_agents }
                : t
            )
          );
        } else {
          setTasks((prev) => prev.filter((t) => t.id !== updated.id));
        }
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as { id: string };
        setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      }
    },
    [projectId, supabase]
  );

  useRealtime({
    table: "tasks",
    filter: `project_id=eq.${projectId}`,
    onPayload: handlePayload,
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.agentId) {
        const assignedViaJunction = t.task_agents?.some((ta) => ta.agent_id === filters.agentId);
        if (!assignedViaJunction && t.agent_id !== filters.agentId) return false;
      }
      return true;
    });
  }, [tasks, filters]);

  const visibleColumns = useMemo(() => {
    if (filters.status) {
      return COLUMNS.filter((col) => col.key === filters.status);
    }
    return COLUMNS;
  }, [filters.status]);

  const grouped = visibleColumns.map((col) => ({
    ...col,
    tasks: filteredTasks.filter((t) => t.status === col.key),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {grouped.map((col) => (
        <div key={col.key} className="flex-shrink-0 w-[280px]">
          {/* Column header */}
          <div className="border-2 border-mac-border-strong bg-mac-white rounded-lg shadow-[2px_2px_0px_#555] mb-3">
            <div className="h-[3px]" style={{ backgroundColor: col.color }} />
            <div className="flex items-center justify-between px-3 py-2">
              <h3 className="text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)]">
                {col.label}
              </h3>
              <span className="text-xs font-bold text-mac-dark-gray bg-mac-light-gray border border-mac-border-strong rounded-full px-2 py-0.5 font-[family-name:var(--font-pixel)]">
                {col.tasks.length}
              </span>
            </div>
          </div>

          {/* Task cards */}
          <div className="space-y-2 min-h-[200px]">
            {col.tasks.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-mac-border p-4 text-center text-xs text-mac-dark-gray font-[family-name:var(--font-pixel)]">
                No tasks
              </div>
            ) : (
              col.tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onClick={() => onTaskClick(task)}
                  problemCount={problemCounts[task.id] || 0}
                />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
