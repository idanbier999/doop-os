"use client";

import { Badge } from "@/components/ui/badge";
import type { TaskWithAgents } from "@/lib/types";

interface TaskCardProps {
  task: TaskWithAgents;
  onClick?: () => void;
  problemCount?: number;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskCard({ task, onClick, problemCount }: TaskCardProps) {
  return (
    <div
      className={`rounded-md border border-mac-border bg-mac-white p-3 hover:bg-mac-highlight-soft transition-all duration-200 ${
        onClick ? "cursor-pointer" : ""
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-mac-black mb-2 line-clamp-2">{task.title}</p>
        {problemCount != null && problemCount > 0 && (
          <span className="inline-flex items-center justify-center shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-severity-critical text-mac-white text-[10px] font-bold font-[family-name:var(--font-pixel)]">
            {problemCount}
          </span>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-mac-dark-gray mb-2 line-clamp-2">{task.description}</p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="priority" value={task.priority} />
        {(() => {
          const primary = task.task_agents?.find((ta) => ta.role === "primary");
          const helperCount = (task.task_agents?.length ?? 0) - (primary ? 1 : 0);
          const agentName = primary?.agents?.name ?? task.agents?.name;
          if (!agentName) return null;
          return (
            <span className="text-xs text-mac-dark-gray truncate max-w-[120px]">
              {agentName}
              {helperCount > 0 ? ` +${helperCount}` : ""}
            </span>
          );
        })()}
      </div>
      <div className="mt-2 text-xs text-mac-gray">{formatDate(task.created_at)}</div>
    </div>
  );
}
