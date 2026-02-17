"use client";

import { useState } from "react";
import { BoardsGrid } from "./boards-grid";
import { CreateBoardModal } from "@/components/boards/create-board-modal";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";

type TaskSlice = Pick<Tables<"tasks">, "id" | "board_id" | "status" | "agent_id">;

interface OverviewClientProps {
  initialBoards: Tables<"boards">[];
  initialTasks: TaskSlice[];
}

export function OverviewClient({
  initialBoards,
  initialTasks,
}: OverviewClientProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
          Overview
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
    </>
  );
}
