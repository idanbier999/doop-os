"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/contexts/workspace-context";

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
  task_updated: "Task updated",
  task_comment: "Commented on task",
  problem_acknowledged: "Problem acknowledged",
  problem_resolved: "Problem resolved",
  problem_dismissed: "Problem dismissed",
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
    <div className="mac-window flex flex-col" style={{ maxHeight: 400 }}>
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-mac-black font-[family-name:var(--font-pixel)]">Recent Activity</h2>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {activity.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-mac-gray font-[family-name:var(--font-pixel)]">
            No activity yet
          </p>
        ) : (
          <ul className="divide-y divide-mac-border">
            {activity.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-mac-highlight" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
                    <span className="font-medium text-mac-black">
                      {entry.agents?.name || "System"}
                    </span>{" "}
                    {actionLabels[entry.action] || entry.action}
                  </p>
                  <p className="mt-0.5 text-xs text-mac-gray font-[family-name:var(--font-pixel)]">
                    {relativeTime(entry.created_at)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
