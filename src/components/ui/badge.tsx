import { type ReactNode } from "react";

const healthColors: Record<string, string> = {
  healthy: "border-l-[#007700] text-[#007700]",
  degraded: "border-l-[#886600] text-[#886600]",
  critical: "border-l-[#CC0000] text-[#CC0000]",
  offline: "border-l-[#666666] text-[#666666]",
};

const severityColors: Record<string, string> = {
  low: "border-l-[#0055CC] text-[#0055CC]",
  medium: "border-l-[#886600] text-[#886600]",
  high: "border-l-[#CC6600] text-[#CC6600]",
  critical: "border-l-[#CC0000] text-[#CC0000]",
};

const stageColors: Record<string, string> = {
  idle: "border-l-[#666666] text-[#666666]",
  running: "border-l-[#007700] text-[#007700]",
  blocked: "border-l-[#CC6600] text-[#CC6600]",
  completed: "border-l-[#0055CC] text-[#0055CC]",
  error: "border-l-[#CC0000] text-[#CC0000]",
};

const statusColors: Record<string, string> = {
  pending: "border-l-[#666666] text-[#666666]",
  in_progress: "border-l-[#0055CC] text-[#0055CC]",
  waiting_on_agent: "border-l-[#7722AA] text-[#7722AA]",
  waiting_on_human: "border-l-[#AA7700] text-[#AA7700]",
  completed: "border-l-[#007700] text-[#007700]",
  cancelled: "border-l-[#666666] text-[#666666]",
};

const priorityColors: Record<string, string> = {
  low: "border-l-[#666666] text-[#666666]",
  medium: "border-l-[#886600] text-[#886600]",
  high: "border-l-[#CC6600] text-[#CC6600]",
  urgent: "border-l-[#CC0000] text-[#CC0000]",
};

const variantMap: Record<string, Record<string, string>> = {
  health: healthColors,
  severity: severityColors,
  stage: stageColors,
  status: statusColors,
  priority: priorityColors,
};

const displayLabels: Record<string, string> = {
  in_progress: "In Progress",
  waiting_on_agent: "Waiting on Agent",
  waiting_on_human: "Waiting on Human",
};

export interface BadgeProps {
  variant: "health" | "severity" | "stage" | "status" | "priority";
  value: string;
  className?: string;
  children?: ReactNode;
}

export function Badge({ variant, value, className = "", children }: BadgeProps) {
  const colors = variantMap[variant]?.[value] ?? "border-l-mac-gray text-mac-dark-gray";
  const label = children ?? displayLabels[value] ?? value.charAt(0).toUpperCase() + value.slice(1);

  return (
    <span
      className={`inline-flex items-center border border-mac-black border-l-[3px] bg-mac-white px-2 py-0.5 text-xs font-bold font-[family-name:var(--font-pixel)] ${colors} ${className}`}
    >
      {label}
    </span>
  );
}
