"use client";

import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Agent {
  id: string;
  name: string;
}

interface ActivityFiltersProps {
  agents: Agent[];
  selectedAgent: string;
  onAgentChange: (agentId: string) => void;
  selectedAction: string;
  onActionChange: (action: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
}

const actionOptions = [
  { value: "", label: "All actions" },
  { value: "agent_registered", label: "Agent Registered" },
  { value: "status_update", label: "Status Update" },
  { value: "problem_reported", label: "Problem Reported" },
  { value: "task_created", label: "Task Created" },
  { value: "task_completed", label: "Task Completed" },
];

export function ActivityFilters({
  agents,
  selectedAgent,
  onAgentChange,
  selectedAction,
  onActionChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
}: ActivityFiltersProps) {
  const agentOptions = [
    { value: "", label: "All agents" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <div className="flex flex-wrap gap-3">
      <div className="w-48">
        <Select
          options={agentOptions}
          value={selectedAgent}
          onChange={(e) => onAgentChange(e.target.value)}
        />
      </div>
      <div className="w-48">
        <Select
          options={actionOptions}
          value={selectedAction}
          onChange={(e) => onActionChange(e.target.value)}
        />
      </div>
      <div className="w-40">
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          placeholder="From"
        />
      </div>
      <div className="w-40">
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          placeholder="To"
        />
      </div>
    </div>
  );
}
