"use client";

import { useCallback, useState } from "react";
import { Card } from "@/components/ui/card";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSupabase } from "@/hooks/use-supabase";
import type { Tables } from "@/lib/database.types";

interface FleetStatsBarProps {
  initialAgentCounts: {
    total: number;
    healthy: number;
    degraded: number;
    critical: number;
    offline: number;
  };
  initialOpenProblems: { total: number; critical: number };
  initialTasksInFlight: number;
}

export function FleetStatsBar({
  initialAgentCounts,
  initialOpenProblems,
  initialTasksInFlight,
}: FleetStatsBarProps) {
  const { workspaceId } = useWorkspace();
  const supabase = useSupabase();
  const [agentCounts, setAgentCounts] = useState(initialAgentCounts);
  const [openProblems, setOpenProblems] = useState(initialOpenProblems);
  const [tasksInFlight, setTasksInFlight] = useState(initialTasksInFlight);

  const refetchAgentCounts = useCallback(async () => {
    const { data } = await supabase
      .from("agents")
      .select("health")
      .eq("workspace_id", workspaceId);

    if (data) {
      const counts = { total: data.length, healthy: 0, degraded: 0, critical: 0, offline: 0 };
      for (const agent of data) {
        const h = agent.health as keyof typeof counts;
        if (h in counts && h !== "total") {
          counts[h]++;
        }
      }
      setAgentCounts(counts);
    }
  }, [workspaceId, supabase]);

  const refetchProblems = useCallback(async () => {
    const { data } = await supabase
      .from("problems")
      .select("severity, agent_id, status")
      .eq("status", "open")
      .in(
        "agent_id",
        (
          await supabase
            .from("agents")
            .select("id")
            .eq("workspace_id", workspaceId)
        ).data?.map((a) => a.id) ?? []
      );

    if (data) {
      setOpenProblems({
        total: data.length,
        critical: data.filter((p) => p.severity === "critical").length,
      });
    }
  }, [workspaceId, supabase]);

  const refetchTasks = useCallback(async () => {
    const { count } = await supabase
      .from("tasks")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["in_progress", "waiting_on_agent", "waiting_on_human"]);

    setTasksInFlight(count ?? 0);
  }, [workspaceId, supabase]);

  useRealtime({ table: "agents", onPayload: refetchAgentCounts });
  useRealtime({ table: "problems", onPayload: refetchProblems });
  useRealtime({ table: "tasks", onPayload: refetchTasks });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {/* Total Agents */}
      <Card className="px-4 py-3">
        <p className="text-sm text-mac-gray">Total Agents</p>
        <p className="mt-1 text-2xl font-[family-name:var(--font-pixel)]">
          {agentCounts.total}
        </p>
      </Card>

      {/* Health Breakdown */}
      <Card className="px-4 py-3">
        <p className="text-sm text-mac-gray">Health Breakdown</p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-[family-name:var(--font-pixel)]">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-healthy)" }}
            />
            {agentCounts.healthy}
          </span>
          <span className="text-mac-gray">&middot;</span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-degraded)" }}
            />
            {agentCounts.degraded}
          </span>
          <span className="text-mac-gray">&middot;</span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-critical)" }}
            />
            {agentCounts.critical}
          </span>
          <span className="text-mac-gray">&middot;</span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-offline)" }}
            />
            {agentCounts.offline}
          </span>
        </div>
      </Card>

      {/* Open Problems */}
      <Card className="px-4 py-3">
        <p className="text-sm text-mac-gray">Open Problems</p>
        <div className="mt-1 flex items-center gap-2 text-2xl font-[family-name:var(--font-pixel)]">
          <span style={{ color: "var(--color-severity-high)" }}>
            {openProblems.total}
          </span>
          <span className="text-sm text-mac-gray">&middot;</span>
          <span className="text-sm" style={{ color: "var(--color-severity-critical)" }}>
            {openProblems.critical} critical
          </span>
        </div>
      </Card>

      {/* Tasks in Flight */}
      <Card className="px-4 py-3">
        <p className="text-sm text-mac-gray">Tasks in Flight</p>
        <p
          className="mt-1 text-2xl font-[family-name:var(--font-pixel)]"
          style={{ color: "var(--color-status-in-progress)" }}
        >
          {tasksInFlight}
        </p>
      </Card>
    </div>
  );
}
