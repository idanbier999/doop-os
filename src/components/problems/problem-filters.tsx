"use client";

import { Select } from "@/components/ui/select";

interface ProblemFiltersProps {
  agents: { id: string; name: string }[];
  severity: string;
  agentId: string;
  status: string;
  onSeverityChange: (value: string) => void;
  onAgentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export function ProblemFilters({
  agents,
  severity,
  agentId,
  status,
  onSeverityChange,
  onAgentChange,
  onStatusChange,
}: ProblemFiltersProps) {
  const severityOptions = [
    { value: "all", label: "All severities" },
    { value: "low", label: "Low" },
    { value: "medium", label: "Medium" },
    { value: "high", label: "High" },
    { value: "critical", label: "Critical" },
  ];

  const statusOptions = [
    { value: "all", label: "All statuses" },
    { value: "open", label: "Open" },
    { value: "acknowledged", label: "Acknowledged" },
    { value: "resolved", label: "Resolved" },
    { value: "dismissed", label: "Dismissed" },
  ];

  const agentOptions = [
    { value: "all", label: "All agents" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-40">
        <Select
          options={severityOptions}
          value={severity}
          onChange={(e) => onSeverityChange(e.target.value)}
        />
      </div>
      <div className="w-44">
        <Select
          options={agentOptions}
          value={agentId}
          onChange={(e) => onAgentChange(e.target.value)}
        />
      </div>
      <div className="w-40">
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        />
      </div>
    </div>
  );
}
