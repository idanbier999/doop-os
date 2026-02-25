"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/contexts/workspace-context";
import { AgentCard } from "@/components/dashboard/agent-card";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

const STAGES = ["idle", "running", "blocked", "completed", "error"] as const;

const stageLabels: Record<string, string> = {
  idle: "Idle",
  running: "Running",
  blocked: "Blocked",
  completed: "Completed",
  error: "Error",
};

const stageBorderColors: Record<string, string> = {
  idle: "border-t-stage-idle",
  running: "border-t-stage-running",
  blocked: "border-t-stage-blocked",
  completed: "border-t-stage-completed",
  error: "border-t-stage-error",
};

interface AgentPipelineProps {
  initialAgents: Tables<"agents">[];
}

export function AgentPipeline({ initialAgents }: AgentPipelineProps) {
  const [agents, setAgents] = useState<Tables<"agents">[]>(initialAgents);
  const { workspaceId } = useWorkspace();

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newAgent = payload.new as Tables<"agents">;
        if (newAgent.workspace_id === workspaceId) {
          setAgents((prev) => [...prev, newAgent]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Tables<"agents">;
        setAgents((prev) =>
          prev.map((a) => (a.id === updated.id ? updated : a))
        );
      } else if (payload.eventType === "DELETE") {
        const old = payload.old as { id?: string };
        if (old.id) {
          setAgents((prev) => prev.filter((a) => a.id !== old.id));
        }
      }
    },
    [workspaceId]
  );

  useRealtime({
    table: "agents",
    onPayload: handlePayload,
  });

  const grouped = STAGES.reduce(
    (acc, stage) => {
      acc[stage] = agents.filter((a) => a.stage === stage);
      return acc;
    },
    {} as Record<string, Tables<"agents">[]>
  );

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
      {STAGES.map((stage) => (
        <div
          key={stage}
          className={`rounded-lg border border-gray-800 border-t-2 bg-gray-900/50 ${stageBorderColors[stage]}`}
        >
          <div className="flex items-center justify-between px-3 py-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-400">
              {stageLabels[stage]}
            </h3>
            <span className="text-xs font-medium text-gray-500">
              {grouped[stage].length}
            </span>
          </div>
          <div className="space-y-2 px-2 pb-3">
            {grouped[stage].length === 0 ? (
              <p className="py-4 text-center text-xs text-gray-600">
                No agents
              </p>
            ) : (
              grouped[stage].map((agent) => (
                <AgentCard key={agent.id} agent={agent} />
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
