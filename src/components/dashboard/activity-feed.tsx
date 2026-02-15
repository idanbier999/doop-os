"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import type { Json } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ActivityEntry = {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  user_id: string | null;
  action: string;
  details: Json | null;
  created_at: string | null;
  agents: { name: string } | null;
};

const actionLabels: Record<string, string> = {
  agent_registered: "Agent registered",
  status_update: "Status updated",
  problem_reported: "Problem reported",
  task_created: "Task created",
  task_completed: "Task completed",
};

interface ActivityFeedProps {
  initialActivity: ActivityEntry[];
  agents: { id: string; name: string }[];
}

export function ActivityFeed({ initialActivity, agents }: ActivityFeedProps) {
  const [activity, setActivity] = useState<ActivityEntry[]>(initialActivity);
  const { workspaceId } = useWorkspace();

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newEntry = payload.new as ActivityEntry;
        if (newEntry.workspace_id === workspaceId) {
          const agentName = agents.find(a => a.id === newEntry.agent_id)?.name ?? null;
          setActivity((prev) => [{ ...newEntry, agents: agentName ? { name: agentName } : null }, ...prev].slice(0, 20));
        }
      }
    },
    [workspaceId, agents]
  );

  useRealtime({
    table: "activity_log",
    onPayload: handlePayload,
  });

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-gray-200">Recent Activity</h2>
      </CardHeader>
      <CardBody className="p-0">
        {activity.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-gray-500">
            No activity yet
          </p>
        ) : (
          <ul className="divide-y divide-gray-800">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-gray-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-300">
                    <span className="font-medium text-gray-100">
                      {entry.agents?.name || "System"}
                    </span>{" "}
                    {actionLabels[entry.action] || entry.action}
                  </p>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {relativeTime(entry.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
