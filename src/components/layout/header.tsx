"use client";

import { useState } from "react";
import { SearchCommand } from "@/components/layout/search-command";
import { useMobileSidebar } from "@/contexts/mobile-sidebar-context";

interface HeaderProps {
  workspaceName: string;
}

export function Header({ workspaceName }: HeaderProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { toggle } = useMobileSidebar();

  return (
    <header className="flex items-center justify-between h-10 px-4 border-b border-mac-border bg-mac-white/90 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2">
        <button
          onClick={toggle}
          className="md:hidden text-mac-black font-[family-name:var(--font-pixel)] text-sm font-bold hover:bg-mac-light-gray px-1"
          aria-label="Toggle menu"
        >
          &#9776;
        </button>
        <span className="text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)]">
          <span className="hidden md:inline">&#9776; </span>{workspaceName}
        </span>
      </div>

      <button
        onClick={() => setSearchOpen(true)}
        className="flex items-center gap-1.5 px-2 py-0.5 text-[11px] text-mac-dark-gray hover:text-mac-black font-[family-name:var(--font-pixel)] border border-mac-border rounded-md bg-mac-light-gray hover:bg-mac-cream transition-colors duration-150"
      >
        Search
        <kbd className="hidden sm:inline px-1 border border-mac-border bg-mac-white text-[10px] text-mac-dark-gray rounded">
          &#8984;K
        </kbd>
      </button>

      <SearchCommand externalOpen={searchOpen} onExternalOpenHandled={() => setSearchOpen(false)} />
    </header>
  );
}
