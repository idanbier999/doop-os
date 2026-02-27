"use client";

import { useCallback, useState } from "react";
import { LineChart, Line } from "recharts";
import { Card } from "@/components/ui/card";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSupabase } from "@/hooks/use-supabase";

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
  problemsSparkline: Array<{ value: number }>;
  tasksSparkline: Array<{ value: number }>;
  yesterdayOpenProblems: number;
  yesterdayTasksInFlight: number;
}

function InlineSparkline({ data, color }: { data: Array<{ value: number }>; color: string }) {
  if (!data || data.length === 0) return null;
  return (
    <LineChart width={64} height={20} data={data}>
      <Line
        type="monotone"
        dataKey="value"
        stroke={color}
        strokeWidth={1}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}

function DeltaIndicator({
  current,
  previous,
  invertPolarity,
}: {
  current: number;
  previous: number;
  invertPolarity?: boolean;
}) {
  const diff = current - previous;
  if (diff === 0) return null;

  const isUp = diff > 0;
  // Default: up = bad (red), down = good (green). invertPolarity flips it.
  const isGood = invertPolarity ? isUp : !isUp;

  return (
    <span
      className="text-xs font-[family-name:var(--font-pixel)]"
      style={{ color: isGood ? "var(--color-health-healthy)" : "var(--color-severity-high)" }}
    >
      {isUp ? "▲" : "▼"}{Math.abs(diff)}
    </span>
  );
}

export function FleetStatsBar({
  initialAgentCounts,
  initialOpenProblems,
  initialTasksInFlight,
  problemsSparkline,
  tasksSparkline,
  yesterdayOpenProblems,
  yesterdayTasksInFlight,
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
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {/* Fleet Health — merges Total Agents + Health Breakdown */}
      <Card className="px-4 py-3">
        <p className="text-sm text-mac-gray">Fleet Health</p>
        <p className="mt-1 text-2xl font-[family-name:var(--font-pixel)]">
          {agentCounts.healthy}/{agentCounts.total}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-healthy)" }}
            />
            <span className="text-xs font-[family-name:var(--font-pixel)]">{agentCounts.healthy}</span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-degraded)" }}
            />
            <span className="text-xs font-[family-name:var(--font-pixel)]">{agentCounts.degraded}</span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-critical)" }}
            />
            <span className="text-xs font-[family-name:var(--font-pixel)]">{agentCounts.critical}</span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-offline)" }}
            />
            <span className="text-xs font-[family-name:var(--font-pixel)]">{agentCounts.offline}</span>
          </span>
        </div>
      </Card>

      {/* Open Problems */}
      <Card className="px-4 py-3">
        <p className="text-sm text-mac-gray">Open Problems</p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="text-2xl font-[family-name:var(--font-pixel)]"
            style={{ color: openProblems.total > 0 ? "var(--color-severity-high)" : undefined }}
          >
            {openProblems.total}
          </span>
          <DeltaIndicator current={openProblems.total} previous={yesterdayOpenProblems} />
          <InlineSparkline data={problemsSparkline} color="var(--color-severity-high)" />
        </div>
        {openProblems.critical > 0 && (
          <p className="mt-1 text-xs font-[family-name:var(--font-pixel)]" style={{ color: "var(--color-severity-critical)" }}>
            {openProblems.critical} critical
          </p>
        )}
      </Card>

      {/* Tasks in Flight */}
      <Card className="px-4 py-3">
        <p className="text-sm text-mac-gray">Tasks in Flight</p>
        <div className="mt-1 flex items-center gap-2">
          <span
            className="text-2xl font-[family-name:var(--font-pixel)]"
            style={{ color: "var(--color-status-in-progress)" }}
          >
            {tasksInFlight}
          </span>
          <DeltaIndicator current={tasksInFlight} previous={yesterdayTasksInFlight} />
          <InlineSparkline data={tasksSparkline} color="var(--color-status-in-progress)" />
        </div>
      </Card>
    </div>
  );
}
