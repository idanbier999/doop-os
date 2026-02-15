"use client";

import { Card } from "@/components/ui/card";

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

function StatCard({ label, value, color }: StatCardProps) {
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </Card>
  );
}

interface StatsBarProps {
  totalAgents: number;
  activeAgents: number;
  openProblems: number;
  pendingTasks: number;
}

export function StatsBar({
  totalAgents,
  activeAgents,
  openProblems,
  pendingTasks,
}: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total Agents" value={totalAgents} color="text-gray-100" />
      <StatCard
        label="Active Now"
        value={activeAgents}
        color="text-health-healthy"
      />
      <StatCard
        label="Open Problems"
        value={openProblems}
        color="text-severity-high"
      />
      <StatCard
        label="Pending Tasks"
        value={pendingTasks}
        color="text-severity-medium"
      />
    </div>
  );
}
