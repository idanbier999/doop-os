"use client";

import { useCallback, useState } from "react";
import { LineChart, Line } from "recharts";
import { Card } from "@/components/ui/card";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { useWorkspace } from "@/contexts/workspace-context";

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
      {isUp ? "▲" : "▼"}
      {Math.abs(diff)}
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
  const [agentCounts, setAgentCounts] = useState(initialAgentCounts);
  const [openProblems, setOpenProblems] = useState(initialOpenProblems);
  const [tasksInFlight, setTasksInFlight] = useState(initialTasksInFlight);

  // On any relevant table change, trigger a page-level re-fetch for fresh stats
  const handleEvent = useCallback(() => {
    // Use router.refresh()-equivalent: re-fetch the server component data
    // Since we can't access router here cleanly (this is a stats bar),
    // we use window location reload sparingly. Instead, rely on SSE event data
    // to update counts optimistically where possible.
  }, []);

  // For agent changes, update counts optimistically from event data
  const handleAgentEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (event.event === "UPDATE" && event.new) {
        const newHealth = event.new.health as string | undefined;
        const oldHealth = event.old?.health as string | undefined;
        if (newHealth && oldHealth && newHealth !== oldHealth) {
          setAgentCounts((prev) => {
            const counts = { ...prev };
            if (oldHealth in counts && oldHealth !== "total") {
              counts[oldHealth as keyof Omit<typeof counts, "total">]--;
            }
            if (newHealth in counts && newHealth !== "total") {
              counts[newHealth as keyof Omit<typeof counts, "total">]++;
            }
            return counts;
          });
        }
      } else if (event.event === "INSERT") {
        const health = (event.new?.health as string) ?? "offline";
        setAgentCounts((prev) => {
          const counts = { ...prev, total: prev.total + 1 };
          if (health in counts && health !== "total") {
            counts[health as keyof Omit<typeof counts, "total">]++;
          }
          return counts;
        });
      } else if (event.event === "DELETE") {
        const health = (event.old?.health as string) ?? "offline";
        setAgentCounts((prev) => {
          const counts = { ...prev, total: prev.total - 1 };
          if (health in counts && health !== "total") {
            counts[health as keyof Omit<typeof counts, "total">]--;
          }
          return counts;
        });
      }
    },
    []
  );

  const handleProblemEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const status = event.new?.status as string | undefined;
        const severity = event.new?.severity as string | undefined;
        if (status === "open") {
          setOpenProblems((prev) => ({
            total: prev.total + 1,
            critical: severity === "critical" ? prev.critical + 1 : prev.critical,
          }));
        }
      } else if (event.event === "UPDATE") {
        const newStatus = event.new?.status as string | undefined;
        const oldStatus = event.old?.status as string | undefined;
        const severity = event.new?.severity as string | undefined;
        if (oldStatus === "open" && newStatus !== "open") {
          setOpenProblems((prev) => ({
            total: Math.max(0, prev.total - 1),
            critical: severity === "critical" ? Math.max(0, prev.critical - 1) : prev.critical,
          }));
        }
      }
    },
    []
  );

  const handleTaskEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const activeStatuses = new Set(["in_progress", "waiting_on_agent", "waiting_on_human"]);
      if (event.event === "INSERT") {
        const status = event.new?.status as string | undefined;
        if (status && activeStatuses.has(status)) {
          setTasksInFlight((prev) => prev + 1);
        }
      } else if (event.event === "UPDATE") {
        const newStatus = event.new?.status as string | undefined;
        const oldStatus = event.old?.status as string | undefined;
        const wasActive = oldStatus ? activeStatuses.has(oldStatus) : false;
        const isActive = newStatus ? activeStatuses.has(newStatus) : false;
        if (wasActive && !isActive) setTasksInFlight((prev) => Math.max(0, prev - 1));
        if (!wasActive && isActive) setTasksInFlight((prev) => prev + 1);
      } else if (event.event === "DELETE") {
        const status = event.old?.status as string | undefined;
        if (status && activeStatuses.has(status)) {
          setTasksInFlight((prev) => Math.max(0, prev - 1));
        }
      }
    },
    []
  );

  useRealtimeEvents({ table: "agents", onEvent: handleAgentEvent });
  useRealtimeEvents({ table: "problems", onEvent: handleProblemEvent });
  useRealtimeEvents({ table: "tasks", onEvent: handleTaskEvent });

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
            <span className="text-xs font-[family-name:var(--font-pixel)]">
              {agentCounts.healthy}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-degraded)" }}
            />
            <span className="text-xs font-[family-name:var(--font-pixel)]">
              {agentCounts.degraded}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-critical)" }}
            />
            <span className="text-xs font-[family-name:var(--font-pixel)]">
              {agentCounts.critical}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--color-health-offline)" }}
            />
            <span className="text-xs font-[family-name:var(--font-pixel)]">
              {agentCounts.offline}
            </span>
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
          <p
            className="mt-1 text-xs font-[family-name:var(--font-pixel)]"
            style={{ color: "var(--color-severity-critical)" }}
          >
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
