"use client";

import { LineChart, Line, ResponsiveContainer } from "recharts";

const healthToNumeric: Record<string, number> = {
  healthy: 3,
  degraded: 2,
  critical: 1,
  offline: 0,
};

const healthToColor: Record<string, string> = {
  healthy: "var(--color-health-healthy)",
  degraded: "var(--color-health-degraded)",
  critical: "var(--color-health-critical)",
  offline: "var(--color-health-offline)",
};

interface HealthSparklineProps {
  updates: Array<{ health: string | null; created_at: string | null }>;
  currentHealth: string;
  width?: number;
  height?: number;
  strokeWidth?: number;
}

export function HealthSparkline({
  updates,
  currentHealth,
  width = 120,
  height = 40,
  strokeWidth = 1.5,
}: HealthSparklineProps) {
  if (!updates || updates.length === 0) return null;

  const data = updates
    .filter((u) => u.health !== null && u.created_at !== null)
    .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime())
    .map((u) => ({
      value: healthToNumeric[u.health!] ?? 0,
    }));

  if (data.length === 0) return null;

  const lineColor = healthToColor[currentHealth] ?? healthToColor.offline;

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={lineColor}
            strokeWidth={strokeWidth}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
