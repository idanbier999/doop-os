"use client";

import { Button } from "@/components/ui/button";

interface TaskViewToggleProps {
  view: "board" | "list";
  onViewChange: (view: "board" | "list") => void;
}

export function TaskViewToggle({ view, onViewChange }: TaskViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-mac-border">
      <Button
        variant={view === "board" ? "primary" : "ghost"}
        size="sm"
        onClick={() => onViewChange("board")}
        className="rounded-r-none border-0"
      >
        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
        </svg>
        Board
      </Button>
      <Button
        variant={view === "list" ? "primary" : "ghost"}
        size="sm"
        onClick={() => onViewChange("list")}
        className="rounded-l-none border-0"
      >
        <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
        </svg>
        List
      </Button>
    </div>
  );
}
