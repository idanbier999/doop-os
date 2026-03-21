"use client";

import { useState, useCallback } from "react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

interface AgentTasksPanelProps {
  agentId: string;
  initialTasks: Tables<"tasks">[];
}

export function AgentTasksPanel({ agentId, initialTasks }: AgentTasksPanelProps) {
  const [tasks, setTasks] = useState<Tables<"tasks">[]>(initialTasks);

  const handleEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const newTask = event.new as Tables<"tasks">;
        if (newTask.agentId === agentId) {
          setTasks((prev) => [newTask, ...prev]);
        }
      } else if (event.event === "UPDATE") {
        const updated = event.new as Tables<"tasks">;
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    },
    [agentId]
  );

  useRealtimeEvents({
    table: "tasks",
    onEvent: handleEvent,
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mac-black">Tasks</h2>
          <span className="text-xs text-mac-dark-gray">
            {tasks.filter((t) => t.status !== "completed" && t.status !== "cancelled").length}{" "}
            active
          </span>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {tasks.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-mac-dark-gray">No tasks assigned</p>
        ) : (
          <ul className="divide-y divide-mac-border">
            {tasks.map((task) => (
              <li key={task.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <Badge variant="status" value={task.status} />
                  <Badge variant="priority" value={task.priority} />
                </div>
                <p className="mt-1 text-sm font-medium text-mac-black">{task.title}</p>
                {task.description && (
                  <p className="mt-0.5 text-xs text-mac-gray line-clamp-2">{task.description}</p>
                )}
                <p className="mt-1 text-xs text-mac-dark-gray">{relativeTime(task.createdAt)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
