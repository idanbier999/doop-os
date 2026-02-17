"use client";

import type { Tables } from "@/lib/database.types";

type ActivityEntry = Tables<"activity_log"> & {
  agents?: { name: string } | null;
};

interface ActivityItemProps {
  entry: ActivityEntry;
}

const actionIcons: Record<string, { path: string; color: string }> = {
  agent_registered: {
    path: "M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z",
    color: "text-blue-400",
  },
  status_update: {
    path: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    color: "text-green-400",
  },
  problem_reported: {
    path: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
    color: "text-red-400",
  },
  task_created: {
    path: "M12 4v16m8-8H4",
    color: "text-blue-400",
  },
  task_completed: {
    path: "M5 13l4 4L19 7",
    color: "text-green-400",
  },
};

function formatTimestamp(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatAction(action: string): string {
  return action.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
}

export function ActivityItem({ entry }: ActivityItemProps) {
  const icon = actionIcons[entry.action] || {
    path: "M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z",
    color: "text-mac-gray",
  };

  return (
    <div className="flex gap-3 py-3">
      <div className={`flex-shrink-0 mt-0.5 ${icon.color}`}>
        <svg
          className="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d={icon.path}
          />
        </svg>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-mac-black">
            {formatAction(entry.action)}
          </span>
          {entry.agents?.name && (
            <span className="text-xs text-mac-dark-gray">
              by {entry.agents.name}
            </span>
          )}
        </div>
        {entry.details && typeof entry.details === "object" && (
          <p className="text-xs text-mac-dark-gray mt-0.5 line-clamp-2">
            {(entry.details as Record<string, unknown>).message
              ? String((entry.details as Record<string, unknown>).message)
              : JSON.stringify(entry.details)}
          </p>
        )}
        <span className="text-xs text-mac-gray mt-1 block">
          {formatTimestamp(entry.created_at)}
        </span>
      </div>
    </div>
  );
}
