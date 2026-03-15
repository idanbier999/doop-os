"use client";

import type { AgentStats } from "@/lib/agent-stats";

interface PerformanceCardsProps {
  stats: AgentStats;
}

function formatDuration(ms: number | null): string {
  if (ms === null) return "\u2014";
  const totalMinutes = Math.floor(ms / 60_000);
  const totalHours = Math.floor(totalMinutes / 60);
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function rateColor(rate: number, greenThreshold: number, yellowThreshold: number): string {
  if (rate >= greenThreshold) return "var(--color-health-healthy)";
  if (rate >= yellowThreshold) return "var(--color-health-degraded)";
  return "var(--color-health-critical)";
}

function problemRateColor(rate: number): string {
  if (rate <= 0.1) return "var(--color-health-healthy)";
  if (rate <= 0.3) return "var(--color-health-degraded)";
  return "var(--color-health-critical)";
}

interface MetricCardProps {
  label: string;
  value: string;
  subtitle?: string;
  indicatorColor?: string;
}

function MetricCard({ label, value, subtitle, indicatorColor }: MetricCardProps) {
  return (
    <div className="rounded-lg border border-mac-border bg-mac-white p-3">
      <div className="flex items-center gap-2">
        {indicatorColor && (
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        )}
        <span className="text-xs text-mac-gray">{label}</span>
      </div>
      <div className="mt-1 text-2xl font-[family-name:var(--font-pixel)] text-mac-black">
        {value}
      </div>
      {subtitle && <div className="mt-0.5 text-xs text-mac-gray">{subtitle}</div>}
    </div>
  );
}

export function PerformanceCards({ stats }: PerformanceCardsProps) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <MetricCard
        label="Completion Rate"
        value={`${stats.completionRate}%`}
        indicatorColor={rateColor(stats.completionRate, 80, 50)}
      />
      <MetricCard
        label="Tasks Handled"
        value={String(stats.totalTasksHandled)}
        subtitle={`${stats.activeTasks} active`}
      />
      <MetricCard label="Avg Duration" value={formatDuration(stats.avgDurationMs)} />
      <MetricCard
        label="Problem Rate"
        value={`${stats.problemsReported} / ${stats.totalTasksHandled}`}
        subtitle="problems / tasks"
        indicatorColor={problemRateColor(stats.problemRate)}
      />
      <MetricCard label="Activity (7d)" value={String(stats.activityCount7d)} />
    </div>
  );
}
