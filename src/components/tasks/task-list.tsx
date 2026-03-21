"use client";

import { useState, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";

type Task = Tables<"tasks"> & { agents?: { name: string } | null };

interface TaskListProps {
  initialTasks: Task[];
}

function formatDate(dateStr: string | Date | null) {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function TaskList({ initialTasks }: TaskListProps) {
  const { workspaceId } = useWorkspace();
  const [tasks, setTasks] = useState<Task[]>(initialTasks);

  const handleEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const newTask = event.new as unknown as Task;
        if (newTask.workspaceId === workspaceId) {
          setTasks((prev) => [newTask, ...prev]);
        }
      } else if (event.event === "UPDATE") {
        const updated = event.new as unknown as Task;
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t)));
      } else if (event.event === "DELETE") {
        const deleted = event.old as unknown as { id: string };
        setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      }
    },
    [workspaceId]
  );

  useRealtimeEvents({
    table: "tasks",
    onEvent: handleEvent,
  });

  if (tasks.length === 0) {
    return (
      <EmptyState message="No tasks yet" description="Create your first task to get started." />
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
        </Tr>
      </Thead>
      <Tbody>
        {tasks.map((task) => (
          <Tr key={task.id}>
            <Td>
              <span className="font-medium text-mac-black">{task.title}</span>
              {task.description && (
                <p className="text-xs text-mac-dark-gray mt-0.5 line-clamp-1">{task.description}</p>
              )}
            </Td>
            <Td>
              <Badge variant="status" value={task.status} />
            </Td>
            <Td>
              <Badge variant="priority" value={task.priority} />
            </Td>
            <Td>{task.agents?.name || "-"}</Td>
            <Td>{formatDate(task.createdAt)}</Td>
          </Tr>
        ))}
      </Tbody>
    </Table>
  );
}
