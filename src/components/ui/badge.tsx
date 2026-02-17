import { type ReactNode } from "react";

const healthColors: Record<string, string> = {
  healthy: "border-l-health-healthy text-health-healthy",
  degraded: "border-l-health-degraded text-health-degraded",
  critical: "border-l-health-critical text-health-critical",
  offline: "border-l-health-offline text-health-offline",
};

const severityColors: Record<string, string> = {
  low: "border-l-severity-low text-severity-low",
  medium: "border-l-severity-medium text-severity-medium",
  high: "border-l-severity-high text-severity-high",
  critical: "border-l-severity-critical text-severity-critical",
};

const stageColors: Record<string, string> = {
  idle: "border-l-stage-idle text-stage-idle",
  running: "border-l-stage-running text-stage-running",
  blocked: "border-l-stage-blocked text-stage-blocked",
  completed: "border-l-stage-completed text-stage-completed",
  error: "border-l-stage-error text-stage-error",
};

const statusColors: Record<string, string> = {
  pending: "border-l-status-pending text-status-pending",
  in_progress: "border-l-status-in-progress text-status-in-progress",
  waiting_on_agent: "border-l-status-waiting-on-agent text-status-waiting-on-agent",
  waiting_on_human: "border-l-status-waiting-on-human text-status-waiting-on-human",
  completed: "border-l-status-completed text-status-completed",
  cancelled: "border-l-status-cancelled text-status-cancelled",
};

const priorityColors: Record<string, string> = {
  low: "border-l-priority-low text-priority-low",
  medium: "border-l-priority-medium text-priority-medium",
  high: "border-l-priority-high text-priority-high",
  urgent: "border-l-priority-urgent text-priority-urgent",
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
      className={`inline-flex items-center border border-mac-border border-l-[3px] bg-mac-white px-2 py-0.5 text-xs font-bold font-[family-name:var(--font-pixel)] rounded-md ${colors} ${className}`}
    >
      {label}
    </span>
  );
}
