"use client";

import { useState } from "react";
import { BoardsGrid } from "@/components/dashboard/boards-grid";
import { CreateBoardModal } from "@/components/boards/create-board-modal";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";

type TaskSlice = Pick<Tables<"tasks">, "id" | "board_id" | "status" | "agent_id">;

interface BoardsPageClientProps {
  initialBoards: Tables<"boards">[];
  initialTasks: TaskSlice[];
}

export function BoardsPageClient({
  initialBoards,
  initialTasks,
}: BoardsPageClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
          Boards
        </h1>
        <Button onClick={() => setModalOpen(true)} size="sm">
          + New Board
        </Button>
      </div>
      <BoardsGrid
        initialBoards={initialBoards}
        initialTasks={initialTasks}
        onCreateBoard={() => setModalOpen(true)}
      />
      <CreateBoardModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
