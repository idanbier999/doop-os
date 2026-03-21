"use client";

import { useState, useCallback, useEffect } from "react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

type ActivityEntry = Tables<"activity_log"> & { agents?: { name: string } | null };

interface TaskActivityProps {
  taskId: string;
  workspaceId: string;
}

const actionLabels: Record<string, string> = {
  task_created: "Task created",
  task_updated: "Task updated",
  task_completed: "Task completed",
  task_comment: "Comment added",
  problem_reported: "Problem reported",
  problem_acknowledged: "Problem acknowledged",
  problem_resolved: "Problem resolved",
  problem_dismissed: "Problem dismissed",
};

function formatActionDetail(entry: ActivityEntry): string {
  const label = actionLabels[entry.action] ?? entry.action;
  const details = entry.details as Record<string, unknown> | null;
  if (details?.field && details?.new_value) {
    return `${label}: ${details.field} -> ${details.new_value}`;
  }
  return label;
}

export function TaskActivity({ taskId, workspaceId }: TaskActivityProps) {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function fetchActivity() {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/v1/activity-log?workspace_id=${workspaceId}&task_id=${taskId}`
        );
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setEntries(data ?? []);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchActivity();
    return () => {
      cancelled = true;
    };
  }, [taskId, workspaceId]);

  const handleEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const newEntry = event.new as unknown as ActivityEntry;
        const details = newEntry.details as Record<string, unknown> | null;
        if (details?.task_id === taskId) {
          setEntries((prev) => [newEntry, ...prev]);
        }
      }
    },
    [taskId]
  );

  useRealtimeEvents({
    table: "activity_log",
    onEvent: handleEvent,
  });

  return (
    <div className="p-4 font-[family-name:var(--font-pixel)]">
      {loading && <p className="text-sm text-mac-gray text-center py-4">Loading activity...</p>}
      {!loading && entries.length === 0 && (
        <p className="text-sm text-mac-gray text-center py-4">No activity yet</p>
      )}
      <ul className="space-y-2">
        {entries.map((entry) => (
          <li key={entry.id} className="border-l-2 border-mac-border pl-3 py-1">
            <p className="text-sm text-mac-black">{formatActionDetail(entry)}</p>
            <div className="flex items-center gap-2 text-xs text-mac-gray mt-0.5">
              {entry.agents?.name && (
                <span>
                  {"\u25C6"} {entry.agents.name}
                </span>
              )}
              {entry.userId && !entry.agentId && <span>{"\u25CB"} User</span>}
              <span>{relativeTime(entry.createdAt)}</span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
