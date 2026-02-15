"use client";

import { useState, useCallback, useMemo } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";
import { ActivityItem } from "./activity-item";
import { ActivityFilters } from "./activity-filters";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";

type ActivityEntry = Tables<"activity_log"> & {
  agents?: { name: string } | null;
};

interface ActivityTimelineProps {
  initialEntries: ActivityEntry[];
  agents: { id: string; name: string }[];
}

export function ActivityTimeline({
  initialEntries,
  agents,
}: ActivityTimelineProps) {
  const { workspaceId } = useWorkspace();
  const [entries, setEntries] = useState<ActivityEntry[]>(initialEntries);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedAction, setSelectedAction] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handlePayload = useCallback(
    (payload: { eventType: string; new: Record<string, unknown> }) => {
      if (payload.eventType === "INSERT") {
        const newEntry = payload.new as unknown as ActivityEntry;
        if (newEntry.workspace_id === workspaceId) {
          setEntries((prev) => [newEntry, ...prev]);
        }
      }
    },
    [workspaceId]
  );

  useRealtime({
    table: "activity_log",
    filter: `workspace_id=eq.${workspaceId}`,
    onPayload: handlePayload,
  });

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedAgent && entry.agent_id !== selectedAgent) return false;
      if (selectedAction && entry.action !== selectedAction) return false;
      if (dateFrom && entry.created_at) {
        if (new Date(entry.created_at) < new Date(dateFrom)) return false;
      }
      if (dateTo && entry.created_at) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(entry.created_at) >= to) return false;
      }
      return true;
    });
  }, [entries, selectedAgent, selectedAction, dateFrom, dateTo]);

  return (
    <div className="space-y-4">
      <ActivityFilters
        agents={agents}
        selectedAgent={selectedAgent}
        onAgentChange={setSelectedAgent}
        selectedAction={selectedAction}
        onActionChange={setSelectedAction}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
      />

      <div className="rounded-lg border border-gray-800 bg-gray-900 divide-y divide-gray-800">
        {filtered.length === 0 ? (
          <EmptyState
            message="No activity found"
            description="Activity will appear here as agents report in."
          />
        ) : (
          <div className="px-4">
            {filtered.map((entry) => (
              <ActivityItem key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
