"use client";

import { useState, useCallback, useMemo } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNotifications } from "@/contexts/notification-context";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { ActivityItem } from "./activity-item";
import { ActivityFilters } from "./activity-filters";
import { EmptyState } from "@/components/ui/empty-state";
import { exportToCSV, exportToJSON, toExportEntries } from "@/lib/export";
import { CATEGORY_ACTIONS, ALL_KNOWN_ACTIONS } from "@/lib/activity-categories";
import type { Tables } from "@/lib/database.types";

type ActivityEntry = Tables<"activity_log"> & {
  agents?: { name: string } | null;
};

interface ActivityTimelineProps {
  initialEntries: ActivityEntry[];
  agents: { id: string; name: string }[];
}

export function ActivityTimeline({ initialEntries, agents }: ActivityTimelineProps) {
  const { workspaceId } = useWorkspace();
  const { addToast } = useNotifications();
  const [entries, setEntries] = useState<ActivityEntry[]>(initialEntries);
  const [selectedAgent, setSelectedAgent] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const newEntry = event.new as unknown as ActivityEntry;
        if (newEntry.workspaceId === workspaceId) {
          setEntries((prev) => [newEntry, ...prev]);
        }
      }
    },
    [workspaceId]
  );

  useRealtimeEvents({
    table: "activity_log",
    onEvent: handleEvent,
  });

  const filtered = useMemo(() => {
    return entries.filter((entry) => {
      if (selectedAgent && entry.agentId !== selectedAgent) return false;

      // Category-based action filtering
      if (selectedCategory) {
        if (selectedCategory === "audit_trail") {
          if (ALL_KNOWN_ACTIONS.includes(entry.action)) return false;
        } else {
          const allowedActions = CATEGORY_ACTIONS[selectedCategory];
          if (allowedActions && !allowedActions.includes(entry.action)) return false;
        }
      }

      if (dateFrom && entry.createdAt) {
        if (new Date(entry.createdAt) < new Date(dateFrom)) return false;
      }
      if (dateTo && entry.createdAt) {
        const to = new Date(dateTo);
        to.setDate(to.getDate() + 1);
        if (new Date(entry.createdAt) >= to) return false;
      }
      return true;
    });
  }, [entries, selectedAgent, selectedCategory, dateFrom, dateTo]);

  // --- Export handlers ---

  const handleExportCSV = useCallback(() => {
    if (filtered.length === 0) return;

    // If > 500 entries, use server-side export
    if (filtered.length > 500) {
      const params = new URLSearchParams({ format: "csv", workspace_id: workspaceId });
      if (selectedAgent) params.set("agent_id", selectedAgent);
      if (selectedCategory) params.set("category", selectedCategory);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      window.open(`/api/activity/export?${params.toString()}`, "_blank");
      addToast({
        type: "info",
        title: "Export started",
        description: "Downloading via server export.",
      });
      return;
    }

    const exportData = toExportEntries(filtered);
    const date = new Date().toISOString().slice(0, 10);
    exportToCSV(exportData, `activity-${date}.csv`);
    addToast({
      type: "info",
      title: "Export complete",
      description: `Exported ${exportData.length} entries to CSV.`,
    });
  }, [filtered, workspaceId, selectedAgent, selectedCategory, dateFrom, dateTo, addToast]);

  const handleExportJSON = useCallback(() => {
    if (filtered.length === 0) return;

    // If > 500 entries, use server-side export
    if (filtered.length > 500) {
      const params = new URLSearchParams({ format: "json", workspace_id: workspaceId });
      if (selectedAgent) params.set("agent_id", selectedAgent);
      if (selectedCategory) params.set("category", selectedCategory);
      if (dateFrom) params.set("from", dateFrom);
      if (dateTo) params.set("to", dateTo);
      window.open(`/api/activity/export?${params.toString()}`, "_blank");
      addToast({
        type: "info",
        title: "Export started",
        description: "Downloading via server export.",
      });
      return;
    }

    const exportData = toExportEntries(filtered);
    const date = new Date().toISOString().slice(0, 10);
    exportToJSON(exportData, `activity-${date}.json`);
    addToast({
      type: "info",
      title: "Export complete",
      description: `Exported ${exportData.length} entries to JSON.`,
    });
  }, [filtered, workspaceId, selectedAgent, selectedCategory, dateFrom, dateTo, addToast]);

  return (
    <div className="space-y-4">
      <ActivityFilters
        agents={agents}
        selectedAgent={selectedAgent}
        onAgentChange={setSelectedAgent}
        selectedCategory={selectedCategory}
        onCategoryChange={setSelectedCategory}
        dateFrom={dateFrom}
        onDateFromChange={setDateFrom}
        dateTo={dateTo}
        onDateToChange={setDateTo}
        onExportCSV={handleExportCSV}
        onExportJSON={handleExportJSON}
        filteredCount={filtered.length}
      />

      <div className="rounded-lg border border-mac-border bg-mac-white divide-y divide-mac-border">
        {filtered.length === 0 ? (
          <EmptyState
            message="No activity found"
            description="Activity will appear here as agents start working"
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
