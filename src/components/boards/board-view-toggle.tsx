"use client";

interface BoardViewToggleProps {
  view: "board" | "list";
  onChange: (view: "board" | "list") => void;
}

export function BoardViewToggle({ view, onChange }: BoardViewToggleProps) {
  return (
    <div className="inline-flex border border-mac-black rounded-[6px] overflow-hidden">
      <button
        onClick={() => onChange("board")}
        className={`px-3 py-1.5 text-sm font-bold font-[family-name:var(--font-pixel)] transition-colors ${
          view === "board"
            ? "bg-mac-black text-mac-white"
            : "bg-mac-white text-mac-black hover:bg-mac-light-gray"
        }`}
        aria-label="Kanban view"
      >
        {/* Grid icon */}
        <svg
          className="w-4 h-4 inline-block mr-1 -mt-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
        Board
      </button>
      <button
        onClick={() => onChange("list")}
        className={`px-3 py-1.5 text-sm font-bold font-[family-name:var(--font-pixel)] border-l border-mac-black transition-colors ${
          view === "list"
            ? "bg-mac-black text-mac-white"
            : "bg-mac-white text-mac-black hover:bg-mac-light-gray"
        }`}
        aria-label="List view"
      >
        {/* List icon */}
        <svg
          className="w-4 h-4 inline-block mr-1 -mt-0.5"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
        List
      </button>
    </div>
  );
}
