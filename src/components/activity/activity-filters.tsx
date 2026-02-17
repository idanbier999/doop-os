"use client";

import { Select } from "@/components/ui/select";
import { DateRange } from "@/components/ui/date-range";

interface Agent {
  id: string;
  name: string;
}

interface Board {
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
  boards: Board[];
  selectedBoard: string;
  onBoardChange: (boardId: string) => void;
}

const actionOptions = [
  { value: "", label: "All actions" },
  { value: "agent_registered", label: "Agent Registered" },
  { value: "status_update", label: "Status Update" },
  { value: "problem_reported", label: "Problem Reported" },
  { value: "task_created", label: "Task Created" },
  { value: "task_completed", label: "Task Completed" },
  { value: "task_updated", label: "Task Updated" },
  { value: "task_comment", label: "Task Comment" },
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
  boards,
  selectedBoard,
  onBoardChange,
}: ActivityFiltersProps) {
  const agentOptions = [
    { value: "", label: "All agents" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  const boardOptions = [
    { value: "", label: "All boards" },
    ...boards.map((b) => ({ value: b.id, label: b.name })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-48">
        <Select
          options={agentOptions}
          value={selectedAgent}
          onChange={(e) => onAgentChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-48">
        <Select
          options={actionOptions}
          value={selectedAction}
          onChange={(e) => onActionChange(e.target.value)}
        />
      </div>
      <div className="w-full sm:w-48">
        <Select
          options={boardOptions}
          value={selectedBoard}
          onChange={(e) => onBoardChange(e.target.value)}
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
