"use client";

import { Select } from "@/components/ui/select";
import { DateRange } from "@/components/ui/date-range";

interface ProblemFiltersProps {
  agents: { id: string; name: string }[];
  severity: string;
  agentId: string;
  status: string;
  taskFilter: string;
  dateFrom: string;
  dateTo: string;
  onSeverityChange: (value: string) => void;
  onAgentChange: (value: string) => void;
  onStatusChange: (value: string) => void;
  onTaskFilterChange: (value: string) => void;
  onDateFromChange: (date: string) => void;
  onDateToChange: (date: string) => void;
}

export function ProblemFilters({
  agents,
  severity,
  agentId,
  status,
  taskFilter,
  dateFrom,
  dateTo,
  onSeverityChange,
  onAgentChange,
  onStatusChange,
  onTaskFilterChange,
  onDateFromChange,
  onDateToChange,
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

  const taskFilterOptions = [
    { value: "all", label: "All tasks" },
    { value: "linked", label: "Linked to task" },
    { value: "unlinked", label: "No task linked" },
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-40">
        <Select
          options={severityOptions}
          value={severity}
          onChange={(e) => onSeverityChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-44">
        <Select
          options={agentOptions}
          value={agentId}
          onChange={(e) => onAgentChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-40">
        <Select
          options={statusOptions}
          value={status}
          onChange={(e) => onStatusChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-44">
        <Select
          options={taskFilterOptions}
          value={taskFilter}
          onChange={(e) => onTaskFilterChange(e.target.value)}
        />
      </div>
      <DateRange
        fromDate={dateFrom}
        toDate={dateTo}
        onFromChange={onDateFromChange}
        onToChange={onDateToChange}
      />
    </div>
  );
}
