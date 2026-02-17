"use client";

import { useState, useCallback, useMemo } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Task = Tables<"tasks"> & { agents?: { name: string } | null };

interface BoardListViewProps {
  initialTasks: Task[];
  boardId: string;
  problemCounts: Record<string, number>;
  filters: { status: string; priority: string; agentId: string };
  onTaskClick: (task: Task) => void;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function BoardListView({
  initialTasks,
  boardId,
  problemCounts,
  filters,
  onTaskClick,
}: BoardListViewProps) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newTask = payload.new as unknown as Task;
        if (newTask.board_id === boardId) {
          setTasks((prev) => [newTask, ...prev]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as Task;
        if (updated.board_id === boardId) {
          setTasks((prev) =>
            prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
          );
        } else {
          const old = payload.old as unknown as { id: string };
          setTasks((prev) => prev.filter((t) => t.id !== old.id));
        }
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as { id: string };
        setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      }
    },
    [boardId]
  );

  useRealtime({
    table: "tasks",
    filter: `board_id=eq.${boardId}`,
    onPayload: handlePayload,
  });

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filters.status && t.status !== filters.status) return false;
      if (filters.priority && t.priority !== filters.priority) return false;
      if (filters.agentId && t.agent_id !== filters.agentId) return false;
      return true;
    });
  }, [tasks, filters]);

  if (filteredTasks.length === 0) {
    return (
      <EmptyState
        message="No tasks found"
        description="No tasks match the current filters."
      />
    );
  }

  return (
    <Table>
      <Thead>
        <Tr>
          <Th>Title</Th>
          <Th>Status</Th>
          <Th>Priority</Th>
          <Th>Agent</Th>
          <Th>Created</Th>
          <Th>Problems</Th>
        </Tr>
      </Thead>
      <Tbody>
        {filteredTasks.map((task) => (
          <Tr
            key={task.id}
            className="cursor-pointer"
            onClick={() => onTaskClick(task)}
          >
            <Td>
              <span className="font-medium text-mac-black">{task.title}</span>
              {task.description && (
                <p className="text-xs text-mac-dark-gray mt-0.5 line-clamp-1">
                  {task.description}
                </p>
              )}
            </Td>
            <Td>
              <Badge variant="status" value={task.status} />
            </Td>
            <Td>
              <Badge variant="priority" value={task.priority} />
            </Td>
            <Td>
              <span className="text-sm text-mac-black">
                {task.agents?.name || "-"}
              </span>
            </Td>
            <Td>
              <span className="text-sm text-mac-dark-gray">
                {formatDate(task.created_at)}
              </span>
            </Td>
            <Td>
              {(problemCounts[task.id] || 0) > 0 ? (
                <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-severity-critical text-mac-white text-xs font-bold font-[family-name:var(--font-pixel)]">
                  {problemCounts[task.id]}
                </span>
              ) : (
                <span className="text-sm text-mac-gray">-</span>
              )}
            </Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
