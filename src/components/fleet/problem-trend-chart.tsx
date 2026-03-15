"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Card } from "@/components/ui/card";

interface ProblemTrendChartProps {
  initialData: { date: string; low: number; medium: number; high: number; critical: number }[];
}

const SEVERITY_COLORS = {
  low: "#0065FF",
  medium: "#997A00",
  high: "#FF8B00",
  critical: "#DE350B",
} as const;

const TOOLTIP_STYLE = {
  backgroundColor: "var(--color-mac-white)",
  border: "1px solid var(--color-mac-border)",
  fontFamily: "var(--font-body)",
};

const AXIS_TICK_STYLE = {
  fontFamily: "var(--font-pixel)",
  fontSize: 12,
  fill: "#4A4E69",
};

function isEmpty(data: ProblemTrendChartProps["initialData"]): boolean {
  return data.every((d) => d.low === 0 && d.medium === 0 && d.high === 0 && d.critical === 0);
}

export function ProblemTrendChart({ initialData }: ProblemTrendChartProps) {
  if (isEmpty(initialData)) {
    return (
      <Card title="Problems (7 days)">
        <p className="text-sm text-mac-dark-gray py-8 text-center">
          No problems reported in the last 7 days
        </p>
      </Card>
    );
  }

  return (
    <Card title="Problems (7 days)">
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={initialData}>
            <XAxis dataKey="date" tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS_TICK_STYLE} axisLine={false} tickLine={false} allowDecimals={false} />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Area
              type="monotone"
              dataKey="low"
              stackId="1"
              stroke={SEVERITY_COLORS.low}
              fill={SEVERITY_COLORS.low}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="medium"
              stackId="1"
              stroke={SEVERITY_COLORS.medium}
              fill={SEVERITY_COLORS.medium}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="high"
              stackId="1"
              stroke={SEVERITY_COLORS.high}
              fill={SEVERITY_COLORS.high}
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Area
              type="monotone"
              dataKey="critical"
              stackId="1"
              stroke={SEVERITY_COLORS.critical}
              fill={SEVERITY_COLORS.critical}
              fillOpacity={0.3}
              strokeWidth={2}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
