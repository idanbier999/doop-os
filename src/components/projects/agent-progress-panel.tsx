"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export interface ProjectAgentInfo {
  id: string;
  agent_id: string;
  role: "lead" | "member";
  status: "idle" | "working" | "done" | "error";
  agent: {
    id: string;
    name: string;
    health: string;
    stage: string;
    webhook_url?: string | null;
  };
  currentTask?: {
    id: string;
    title: string;
    status: string;
  } | null;
  taskStats: {
    total: number;
    completed: number;
  };
  recentActivity: Array<{
    id: string;
    action: string;
    created_at: string;
    details?: Record<string, unknown>;
  }>;
  webhookStatus?: {
    total: number;
    delivered: number;
    failed: number;
    pending: number;
  };
}

export interface AgentProgressPanelProps {
  agents: ProjectAgentInfo[];
  projectId: string;
}

const statusDotColors: Record<string, string> = {
  working: "bg-health-healthy",
  idle: "bg-health-offline",
  done: "bg-stage-completed",
  error: "bg-health-critical",
};

const roleBorderColors: Record<string, string> = {
  lead: "border-mac-highlight",
  member: "border-mac-border",
};

function AgentCard({ info }: { info: ProjectAgentInfo }) {
  const { taskStats } = info;
  const pct =
    taskStats.total > 0
      ? Math.round((taskStats.completed / taskStats.total) * 100)
      : 0;

  return (
    <div
      className={`border rounded-lg p-4 bg-mac-white ${roleBorderColors[info.role]}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={`h-2.5 w-2.5 shrink-0 rounded-full ${statusDotColors[info.status] ?? "bg-mac-gray"}`}
          />
          <span className="text-sm font-bold text-mac-black truncate">
            {info.agent.name}
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`inline-flex items-center border border-mac-border px-1.5 py-0.5 text-xs font-bold font-[family-name:var(--font-pixel)] rounded-md ${
              info.role === "lead"
                ? "border-l-[3px] border-l-mac-highlight text-mac-highlight"
                : "text-mac-dark-gray"
            }`}
          >
            {info.role}
          </span>
          <Badge variant="health" value={info.agent.health} />
        </div>
      </div>

      {/* Current task */}
      <div className="mb-3">
        <p className="text-xs text-mac-gray mb-1 font-[family-name:var(--font-pixel)]">
          Current Task
        </p>
        {info.currentTask ? (
          <div className="flex items-center gap-2">
            <Badge variant="status" value={info.currentTask.status} />
            <span className="text-xs text-mac-dark-gray truncate">
              {info.currentTask.title}
            </span>
          </div>
        ) : (
          <span className="text-xs text-mac-gray">No active task</span>
        )}
      </div>

      {/* Task progress bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-mac-gray font-[family-name:var(--font-pixel)]">
            Tasks
          </p>
          <span className="text-xs text-mac-dark-gray">
            {taskStats.completed}/{taskStats.total}
          </span>
        </div>
        <div className="h-1.5 bg-mac-light-gray rounded-full overflow-hidden">
          <div
            className="h-full bg-green-600 rounded-full transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Recent activity */}
      {info.recentActivity.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-mac-gray mb-1 font-[family-name:var(--font-pixel)]">
            Recent Activity
          </p>
          <ul className="space-y-1">
            {info.recentActivity.slice(0, 5).map((activity) => (
              <li key={activity.id} className="flex items-center justify-between gap-2">
                <span className="text-xs text-mac-dark-gray truncate">
                  {activity.action}
                </span>
                <span className="text-xs text-mac-gray shrink-0">
                  {relativeTime(activity.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Webhook status */}
      {info.webhookStatus && info.webhookStatus.total > 0 && (
        <div>
          <p className="text-xs text-mac-gray mb-1 font-[family-name:var(--font-pixel)]">
            Webhooks
          </p>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-xs text-mac-gray">
              <span className="h-1.5 w-1.5 rounded-full bg-mac-gray inline-block" />
              {info.webhookStatus.pending} pending
            </span>
            <span className="flex items-center gap-1 text-xs text-green-600">
              <span className="h-1.5 w-1.5 rounded-full bg-green-600 inline-block" />
              {info.webhookStatus.delivered} delivered
            </span>
            {info.webhookStatus.failed > 0 && (
              <span className="flex items-center gap-1 text-xs text-severity-critical">
                <span className="h-1.5 w-1.5 rounded-full bg-severity-critical inline-block" />
                {info.webhookStatus.failed} failed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AgentProgressPanel({
  agents: initialAgents,
  projectId,
}: AgentProgressPanelProps) {
  const [agents, setAgents] = useState<ProjectAgentInfo[]>(initialAgents);

  const handleAgentUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "UPDATE") {
        const updated = payload.new as { id: string; status?: string };
        setAgents((prev) =>
          prev.map((a) =>
            a.id === updated.id
              ? { ...a, ...(updated.status ? { status: updated.status as ProjectAgentInfo["status"] } : {}) }
              : a
          )
        );
      }
    },
    []
  );

  useRealtime({
    table: "project_agents",
    filter: `project_id=eq.${projectId}`,
    onPayload: handleAgentUpdate,
  });

  if (agents.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="mb-4 text-4xl font-[family-name:var(--font-pixel)] text-mac-gray select-none">
          &#9744;
        </div>
        <h3 className="text-lg font-bold text-mac-black font-[family-name:var(--font-pixel)]">
          No agents assigned
        </h3>
        <p className="mt-1 text-sm text-mac-dark-gray">
          Assign agents to this project to track their progress
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {agents.map((info) => (
        <AgentCard key={info.id} info={info} />
      ))}
    </div>
  );
}
