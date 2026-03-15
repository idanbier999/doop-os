"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/contexts/workspace-context";

import { relativeTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
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

function getActivityDescription(entry: ActivityEntry): string {
  const details = entry.details as Record<string, unknown> | null;
  const title = (details?.title || details?.task_title) as string | undefined;

  switch (entry.action) {
    case "task_completed":
      return title ? `completed '${title}'` : "completed a task";
    case "task_created":
      return title ? `created '${title}'` : "created a task";
    case "task_updated":
      return title ? `updated '${title}'` : "updated a task";
    case "status_update": {
      const status = (details?.new_status || details?.health) as string | undefined;
      return status ? `status → ${status}` : "sent a status update";
    }
    case "problem_reported": {
      const severity = details?.severity as string | undefined;
      const msg = details?.message as string | undefined;
      if (msg) return `reported: ${msg}`;
      return severity ? `reported a ${severity} problem` : "reported a problem";
    }
    case "problem_acknowledged":
      return "acknowledged a problem";
    case "problem_resolved":
      return "resolved a problem";
    case "problem_dismissed":
      return "dismissed a problem";
    case "task_comment":
      return title ? `commented on '${title}'` : "commented on a task";
    case "agent_registered":
      return "registered";
    default:
      return entry.action.replace(/_/g, " ");
  }
}

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
          const agentName = agents.find((a) => a.id === newEntry.agent_id)?.name ?? null;
          setActivity((prev) =>
            [{ ...newEntry, agents: agentName ? { name: agentName } : null }, ...prev].slice(0, 20)
          );
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
    <div className="mac-window flex flex-col max-h-[400px]">
      <div className="shrink-0 px-4 pt-4 pb-2">
        <h2 className="text-sm font-semibold text-mac-black font-[family-name:var(--font-pixel)]">
          Recent Activity
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {activity.length === 0 ? (
          <EmptyState
            message="No activity yet"
            description="Activity appears here when agents send heartbeats, complete tasks, or report problems."
          />
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
                    {getActivityDescription(entry)}
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
