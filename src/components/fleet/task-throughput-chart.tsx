"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { Card } from "@/components/ui/card";

interface TaskThroughputChartProps {
  initialData: { date: string; created: number; completed: number }[];
}

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

function isEmpty(data: TaskThroughputChartProps["initialData"]): boolean {
  return data.every((d) => d.created === 0 && d.completed === 0);
}

export function TaskThroughputChart({ initialData }: TaskThroughputChartProps) {
  if (isEmpty(initialData)) {
    return (
      <Card title="Task Throughput (7 days)">
        <p className="text-sm text-mac-dark-gray py-8 text-center">
          No task activity in the last 7 days
        </p>
      </Card>
    );
  }

  return (
    <Card title="Task Throughput (7 days)">
      <div className="p-4">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={initialData}>
            <XAxis
              dataKey="date"
              tick={AXIS_TICK_STYLE}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={AXIS_TICK_STYLE}
              axisLine={false}
              tickLine={false}
              allowDecimals={false}
            />
            <Tooltip contentStyle={TOOLTIP_STYLE} />
            <Legend
              wrapperStyle={{ fontFamily: "var(--font-body)", fontSize: 12 }}
            />
            <Bar
              dataKey="created"
              name="Created"
              fill="#0065FF"
              radius={[2, 2, 0, 0]}
            />
            <Bar
              dataKey="completed"
              name="Completed"
              fill="#00875A"
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}
