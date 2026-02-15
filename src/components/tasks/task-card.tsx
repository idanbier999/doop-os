"use client";

import { Badge } from "@/components/ui/badge";
import type { Tables } from "@/lib/database.types";

type Task = Tables<"tasks"> & { agents?: { name: string } | null };

interface TaskCardProps {
  task: Task;
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function TaskCard({ task }: TaskCardProps) {
  return (
    <div className="rounded-md border border-gray-800 bg-gray-900 p-3 hover:border-gray-700 transition-colors">
      <p className="text-sm font-medium text-gray-100 mb-2 line-clamp-2">
        {task.title}
      </p>
      {task.description && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2">
          {task.description}
        </p>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="priority" value={task.priority} />
        {task.agents?.name && (
          <span className="text-xs text-gray-500 truncate max-w-[120px]">
            {task.agents.name}
          </span>
        )}
      </div>
      <div className="mt-2 text-xs text-gray-600">
        {formatDate(task.created_at)}
      </div>
    </div>
  );
}
