"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRouter } from "next/navigation";

type ResultType = "agent" | "problem" | "task";

interface SearchResult {
  id: string;
  type: ResultType;
  title: string;
  subtitle?: string;
  href: string;
}

const TYPE_CONFIG: Record<ResultType, { icon: string; label: string }> = {
  agent: { icon: "\u25C6", label: "Agents" },
  problem: { icon: "\u26A0", label: "Problems" },
  task: { icon: "\u2610", label: "Tasks" },
};

const RESULT_LIMIT = 5;

interface SearchCommandProps {
  externalOpen?: boolean;
  onExternalOpenHandled?: () => void;
}

export function SearchCommand({ externalOpen, onExternalOpenHandled }: SearchCommandProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const supabase = useSupabase();

  const openSearch = useCallback(() => {
    setOpen(true);
  }, []);

  const closeSearch = useCallback(() => {
    setOpen(false);
    setQuery("");
    setResults([]);
    setSelectedIndex(0);
  }, []);

  // Handle external open trigger from header button
  useEffect(() => {
    if (externalOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing prop to state is intentional
      setOpen(true);
      onExternalOpenHandled?.();
    }
  }, [externalOpen, onExternalOpenHandled]);

  // Global Cmd+K / Ctrl+K listener
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        if (open) {
          closeSearch();
        } else {
          openSearch();
        }
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, openSearch, closeSearch]);

  // Manage dialog open/close
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open) {
      dialog.showModal();
      // Focus input after dialog opens
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      dialog.close();
    }
  }, [open]);

  // Handle dialog native close (Escape key)
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => closeSearch();
    dialog.addEventListener("close", handleClose);
    return () => dialog.removeEventListener("close", handleClose);
  }, [closeSearch]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    if (!query.trim()) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing state on empty query is intentional
      setResults([]);
      setSelectedIndex(0);
      setLoading(false);
      return;
    }

    // eslint-disable-next-line react-hooks/set-state-in-effect -- setting loading state before async search
    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const pattern = `%${query.trim()}%`;
      const allResults: SearchResult[] = [];

      // Search agents (name and tags)
      const { data: agents } = await supabase
        .from("agents")
        .select("id, name, agent_type, tags")
        .eq("workspace_id", workspaceId)
        .ilike("name", pattern)
        .limit(RESULT_LIMIT);

      if (agents) {
        for (const a of agents) {
          allResults.push({
            id: a.id,
            type: "agent",
            title: a.name,
            subtitle: a.agent_type ?? undefined,
            href: `/dashboard/agents/${a.id}`,
          });
        }
      }

      // Also search agents by tags (separate query since ilike on arrays is tricky)
      const { data: agentsByTag } = await supabase
        .from("agents")
        .select("id, name, agent_type, tags")
        .eq("workspace_id", workspaceId)
        .contains("tags", [query.trim()])
        .limit(RESULT_LIMIT);

      if (agentsByTag) {
        const existingIds = new Set(allResults.map((r) => r.id));
        for (const a of agentsByTag) {
          if (!existingIds.has(a.id)) {
            allResults.push({
              id: a.id,
              type: "agent",
              title: a.name,
              subtitle: a.tags?.join(", ") ?? undefined,
              href: `/dashboard/agents/${a.id}`,
            });
          }
        }
      }

      // Problems don't have workspace_id directly — filter via agent IDs.
      const { data: workspaceAgents } = await supabase
        .from("agents")
        .select("id")
        .eq("workspace_id", workspaceId);

      const agentIds = workspaceAgents?.map((a) => a.id) ?? [];

      if (agentIds.length > 0) {
        const { data: problemResults } = await supabase
          .from("problems")
          .select("id, title, severity")
          .in("agent_id", agentIds)
          .ilike("title", pattern)
          .limit(RESULT_LIMIT);

        if (problemResults) {
          for (const p of problemResults) {
            allResults.push({
              id: p.id,
              type: "problem",
              title: p.title,
              subtitle: p.severity,
              href: `/dashboard/problems`,
            });
          }
        }
      }

      // Search tasks
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, status")
        .eq("workspace_id", workspaceId)
        .ilike("title", pattern)
        .limit(RESULT_LIMIT);

      if (tasks) {
        for (const t of tasks) {
          allResults.push({
            id: t.id,
            type: "task",
            title: t.title,
            subtitle: t.status,
            href: `/dashboard/tasks`,
          });
        }
      }

      setResults(allResults);
      setSelectedIndex(0);
      setLoading(false);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [query, workspaceId]);

  // Navigate to selected result
  const navigateTo = useCallback(
    (result: SearchResult) => {
      closeSearch();
      router.push(result.href);
    },
    [closeSearch, router]
  );

  // Keyboard navigation
  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[selectedIndex]) {
        navigateTo(results[selectedIndex]);
      }
    }
  }

  // Group results by type
  const groupedResults: { type: ResultType; items: SearchResult[] }[] = [];
  const typeOrder: ResultType[] = ["agent", "task", "problem"];
  for (const type of typeOrder) {
    const items = results.filter((r) => r.type === type);
    if (items.length > 0) {
      groupedResults.push({ type, items });
    }
  }

  // Pre-compute flat index for each result
  const flatIndexMap = new Map<string, number>();
  let counter = 0;
  for (const group of groupedResults) {
    for (const item of group.items) {
      flatIndexMap.set(item.id, counter++);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="backdrop:bg-black/40 glass-overlay bg-transparent p-0 m-auto mt-[15vh] max-sm:mt-0 max-sm:w-full max-sm:h-full max-sm:max-w-none max-sm:max-h-none"
      onClick={(e) => {
        if (e.target === dialogRef.current) closeSearch();
      }}
    >
      <div className="border border-mac-border rounded-lg bg-mac-white shadow-lg w-[480px] max-sm:w-full max-sm:h-full max-sm:shadow-none max-sm:rounded-none overflow-hidden">
        <div className="">
          {/* Title bar */}
          <div className="mac-title-bar">
            <button onClick={closeSearch} className="mac-close-box" aria-label="Close" />
            <span className="mac-title-bar-title">Search</span>
          </div>

          {/* Search input */}
          <div className="p-3 border-b border-mac-border">
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search agents, tasks, problems..."
              className="w-full rounded-md border border-mac-border bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray focus:outline-none focus:ring-2 focus:ring-mac-highlight font-[family-name:var(--font-pixel)]"
            />
          </div>

          {/* Results */}
          <div className="max-h-[360px] overflow-y-auto">
            {loading && query.trim() && (
              <div className="px-3 py-4 text-sm text-mac-dark-gray text-center font-[family-name:var(--font-pixel)]">
                Searching...
              </div>
            )}

            {!loading && query.trim() && results.length === 0 && (
              <div className="px-3 py-4 text-sm text-mac-dark-gray text-center font-[family-name:var(--font-pixel)]">
                No results found
              </div>
            )}

            {!loading && !query.trim() && (
              <div className="px-3 py-4 text-sm text-mac-dark-gray text-center font-[family-name:var(--font-pixel)]">
                Type to search across your workspace
              </div>
            )}

            {!loading &&
              groupedResults.map((group) => (
                <div key={group.type}>
                  {/* Category header */}
                  <div className="px-3 py-1.5 text-[11px] font-bold text-mac-dark-gray bg-mac-light-gray border-b border-mac-border font-[family-name:var(--font-pixel)]">
                    {TYPE_CONFIG[group.type].icon} {TYPE_CONFIG[group.type].label}
                  </div>

                  {/* Items */}
                  {group.items.map((result) => {
                    const idx = flatIndexMap.get(result.id) ?? 0;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={result.id}
                        onClick={() => navigateTo(result)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full text-left px-3 py-1.5 flex items-center gap-2 text-sm border-b border-mac-light-gray font-[family-name:var(--font-pixel)] transition-colors duration-150 ${
                          isSelected
                            ? "bg-mac-highlight text-mac-highlight-text"
                            : "text-mac-black hover:bg-mac-highlight-soft"
                        }`}
                      >
                        <span className="text-base leading-none shrink-0">
                          {TYPE_CONFIG[result.type].icon}
                        </span>
                        <span className="truncate">{result.title}</span>
                        {result.subtitle && (
                          <span
                            className={`ml-auto text-[11px] shrink-0 ${
                              isSelected ? "text-mac-highlight-text/70" : "text-mac-dark-gray"
                            }`}
                          >
                            {result.subtitle}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))}
          </div>

          {/* Footer hints */}
          <div className="px-3 py-2 border-t border-mac-border bg-mac-light-gray flex items-center gap-3 text-[11px] text-mac-dark-gray font-[family-name:var(--font-pixel)]">
            <span>
              <kbd className="px-1 border border-mac-border bg-mac-white text-mac-dark-gray rounded">
                &uarr;&darr;
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="px-1 border border-mac-border bg-mac-white text-mac-dark-gray rounded">
                &crarr;
              </kbd>{" "}
              open
            </span>
            <span>
              <kbd className="px-1 border border-mac-border bg-mac-white text-mac-dark-gray rounded">
                esc
              </kbd>{" "}
              close
            </span>
          </div>
        </div>
      </div>
    </dialog>
  );
}
