"use client";

import { Select } from "@/components/ui/select"
import { DateRange } from "@/components/ui/date-range"
import { Button } from "@/components/ui/button"
import { CATEGORY_ACTIONS } from "@/lib/activity-categories"

export { CATEGORY_ACTIONS }

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
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  dateFrom: string;
  onDateFromChange: (date: string) => void;
  dateTo: string;
  onDateToChange: (date: string) => void;
  boards: Board[];
  selectedBoard: string;
  onBoardChange: (boardId: string) => void;
  onExportCSV: () => void;
  onExportJSON: () => void;
  filteredCount: number;
}

const categoryOptions = [
  { value: "", label: "All Events" },
  { value: "agent_lifecycle", label: "Agent Lifecycle" },
  { value: "task_events", label: "Task Events" },
  { value: "problems", label: "Problems" },
  { value: "audit_trail", label: "Audit Trail" },
]

export function ActivityFilters({
  agents,
  selectedAgent,
  onAgentChange,
  selectedCategory,
  onCategoryChange,
  dateFrom,
  onDateFromChange,
  dateTo,
  onDateToChange,
  boards,
  selectedBoard,
  onBoardChange,
  onExportCSV,
  onExportJSON,
  filteredCount,
}: ActivityFiltersProps) {
  const agentOptions = [
    { value: "", label: "All agents" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ]

  const boardOptions = [
    { value: "", label: "All boards" },
    ...boards.map((b) => ({ value: b.id, label: b.name })),
  ]

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
          options={categoryOptions}
          value={selectedCategory}
          onChange={(e) => onCategoryChange(e.target.value)}
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
      <div className="flex gap-2 ml-auto">
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportCSV}
          disabled={filteredCount === 0}
        >
          Export CSV
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={onExportJSON}
          disabled={filteredCount === 0}
        >
          Export JSON
        </Button>
      </div>
    </div>
  )
}
