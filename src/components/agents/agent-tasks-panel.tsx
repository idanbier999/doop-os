"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface AgentTasksPanelProps {
  agentId: string;
  initialTasks: Tables<"tasks">[];
}

export function AgentTasksPanel({ agentId, initialTasks }: AgentTasksPanelProps) {
  const [tasks, setTasks] = useState<Tables<"tasks">[]>(initialTasks);

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newTask = payload.new as Tables<"tasks">;
        if (newTask.agent_id === agentId) {
          setTasks((prev) => [newTask, ...prev]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Tables<"tasks">;
        setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
      }
    },
    [agentId]
  );

  useRealtime({
    table: "tasks",
    filter: `agent_id=eq.${agentId}`,
    onPayload: handlePayload,
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
                <p className="mt-1 text-xs text-mac-dark-gray">{relativeTime(task.created_at)}</p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
