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
      <p className="text-xs font-medium uppercase tracking-wide text-mac-dark-gray font-[family-name:var(--font-pixel)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${color} font-[family-name:var(--font-pixel)]`}>{value}</p>
    </Card>
  );
}

interface StatsBarProps {
  totalBoards: number;
  totalTasks: number;
  inProgress: number;
  openProblems: number;
}

export function StatsBar({
  totalBoards,
  totalTasks,
  inProgress,
  openProblems,
}: StatsBarProps) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total Boards" value={totalBoards} color="text-mac-black" />
      <StatCard label="Total Tasks" value={totalTasks} color="text-mac-black" />
      <StatCard
        label="In Progress"
        value={inProgress}
        color="text-[#0055CC]"
      />
      <StatCard
        label="Open Problems"
        value={openProblems}
        color="text-[#CC6600]"
      />
    </div>
  );
}
