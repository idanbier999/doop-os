import Link from "next/link";
import type { Tables } from "@/lib/database.types";

interface BoardHeaderProps {
  board: Tables<"boards">;
  taskCount: number;
  completedCount: number;
  activeAgentCount: number;
}

export function BoardHeader({
  board,
  taskCount,
  completedCount,
  activeAgentCount,
}: BoardHeaderProps) {
  return (
    <div>
      <Link
        href="/dashboard"
        className="inline-flex items-center text-sm text-mac-dark-gray hover:text-mac-black font-[family-name:var(--font-pixel)] mb-3 transition-colors"
      >
        &larr; Overview
      </Link>

      <div
        className="h-[6px] w-full rounded-t-sm mb-3"
        style={{ backgroundColor: board.color || "#666666" }}
      />

      <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
        {board.name}
      </h1>

      {board.description && (
        <p className="text-sm text-mac-dark-gray mt-1">{board.description}</p>
      )}

      <p className="text-sm text-mac-dark-gray mt-2 font-[family-name:var(--font-pixel)]">
        {taskCount} {taskCount === 1 ? "task" : "tasks"} &middot;{" "}
        {completedCount} completed &middot;{" "}
        {activeAgentCount} {activeAgentCount === 1 ? "agent" : "agents"} active
      </p>
    </div>
  );
}
