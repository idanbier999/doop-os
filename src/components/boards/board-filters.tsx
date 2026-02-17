"use client";

import { Select } from "@/components/ui/select";
import { DateRange } from "@/components/ui/date-range";

interface BoardFiltersProps {
  agents: { id: string; name: string }[];
  filters: {
    status: string;
    priority: string;
    agentId: string;
    dateFrom: string;
    dateTo: string;
  };
  onFiltersChange: (filters: {
    status: string;
    priority: string;
    agentId: string;
    dateFrom: string;
    dateTo: string;
  }) => void;
}

const statusOptions = [
  { value: "", label: "All Statuses" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In Progress" },
  { value: "waiting_on_agent", label: "Waiting on Agent" },
  { value: "waiting_on_human", label: "Waiting on Human" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const priorityOptions = [
  { value: "", label: "All Priorities" },
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function BoardFilters({ agents, filters, onFiltersChange }: BoardFiltersProps) {
  const agentOptions = [
    { value: "", label: "All Agents" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  return (
    <div className="flex flex-wrap items-end gap-3">
      <div className="w-full sm:w-44">
        <Select
          id="filter-status"
          options={statusOptions}
          value={filters.status}
          onChange={(e) =>
            onFiltersChange({ ...filters, status: e.target.value })
          }
        />
      </div>
      <div className="w-full sm:w-44">
        <Select
          id="filter-priority"
          options={priorityOptions}
          value={filters.priority}
          onChange={(e) =>
            onFiltersChange({ ...filters, priority: e.target.value })
          }
        />
      </div>
      <div className="w-full sm:w-44">
        <Select
          id="filter-agent"
          options={agentOptions}
          value={filters.agentId}
          onChange={(e) =>
            onFiltersChange({ ...filters, agentId: e.target.value })
          }
        />
      </div>
      <DateRange
        fromDate={filters.dateFrom}
        toDate={filters.dateTo}
        onFromChange={(date) =>
          onFiltersChange({ ...filters, dateFrom: date })
        }
        onToChange={(date) =>
          onFiltersChange({ ...filters, dateTo: date })
        }
      />
    </div>
  );
}
