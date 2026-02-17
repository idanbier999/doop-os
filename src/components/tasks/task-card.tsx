"use client";

import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/lib/database.types";

type Task = Tables<"tasks"> & { agents?: { name: string } | null };

interface TaskCardProps {
  task: Task;
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
      className={`rounded-sm border border-mac-black bg-mac-white p-3 hover:bg-mac-light-gray transition-colors ${
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
        <p className="text-sm font-medium text-mac-black mb-2 line-clamp-2">
          {task.title}
        </p>
        {problemCount != null && problemCount > 0 && (
          <span className="inline-flex items-center justify-center shrink-0 min-w-[18px] h-[18px] px-1 rounded-full bg-[#CC0000] text-mac-white text-[10px] font-bold font-[family-name:var(--font-pixel)]">
            {problemCount}
          </span>
        )}
      </div>
      {task.description && (
        <p className="text-xs text-mac-dark-gray mb-2 line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="priority" value={task.priority} />
        {task.agents?.name && (
          <span className="text-xs text-mac-dark-gray truncate max-w-[120px]">
            {task.agents.name}
          </span>
        )}
      </div>
      <div className="mt-2 text-xs text-mac-gray">
        {formatDate(task.created_at)}
      </div>
    </div>
  );
}
