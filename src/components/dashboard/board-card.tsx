"use client";

import Link from "next/link";
import type { Tables } from "@/lib/database.types";

interface BoardCardProps {
  board: Tables<"boards">;
  taskCount: number;
  completedCount: number;
  activeAgentCount: number;
}

export function BoardCard({
  board,
  taskCount,
  completedCount,
  activeAgentCount,
}: BoardCardProps) {
  const completionPct = taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0;
  const boardColor = board.color || "#666666";

  return (
    <Link href={`/dashboard/boards/${board.id}`} className="block group">
      <div className="mac-window transition-all duration-200 group-hover:shadow-[3px_3px_0px_#333] group-hover:-translate-y-0.5">
        {/* Colored top bar */}
        <div className="h-1" style={{ backgroundColor: boardColor }} />
        <div className="p-4 bg-mac-white">
          <h3 className="text-base font-bold text-mac-black font-[family-name:var(--font-pixel)] truncate">
            {board.name}
          </h3>
          {board.description && (
            <p className="mt-0.5 text-sm text-mac-dark-gray truncate">
              {board.description}
            </p>
          )}

          {/* Progress bar */}
          <div className="mt-3 h-1.5 w-full rounded-full bg-mac-light-gray border border-mac-gray">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${completionPct}%`,
                backgroundColor: boardColor,
              }}
            />
          </div>

          {/* Stats row */}
          <div className="mt-2 flex items-center gap-1 text-xs text-mac-dark-gray font-[family-name:var(--font-pixel)]">
            <span>{taskCount} tasks</span>
            <span>&middot;</span>
            <span>{completionPct}% complete</span>
            <span>&middot;</span>
            <span>{activeAgentCount} agents</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
