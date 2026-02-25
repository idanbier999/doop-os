"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";

interface AgentOption {
  id: string;
  name: string;
}

export interface AgentAssignment {
  agent_id: string;
  role: "primary" | "helper";
}

interface AgentMultiSelectProps {
  agents: AgentOption[];
  selected: AgentAssignment[];
  onChange: (assignments: AgentAssignment[]) => void;
  disabled?: boolean;
  label?: string;
}

export function AgentMultiSelect({
  agents,
  selected,
  onChange,
  disabled = false,
  label,
}: AgentMultiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  const updatePosition = useCallback(() => {
    if (!buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    setDropdownStyle({
      position: "fixed",
      left: rect.left,
      bottom: window.innerHeight - rect.top + 4,
      width: Math.max(rect.width, 200),
      zIndex: 9999,
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        const dropdown = document.getElementById("agent-multi-dropdown");
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedIds = new Set(selected.map((s) => s.agent_id));
  const primaryId = selected.find((s) => s.role === "primary")?.agent_id;

  function toggleAgent(agentId: string) {
    if (selectedIds.has(agentId)) {
      const next = selected.filter((s) => s.agent_id !== agentId);
      if (agentId === primaryId && next.length > 0) {
        next[0] = { ...next[0], role: "primary" };
      }
      onChange(next);
    } else {
      const isFirst = selected.length === 0;
      onChange([
        ...selected,
        { agent_id: agentId, role: isFirst ? "primary" : "helper" },
      ]);
    }
  }

  function setPrimary(agentId: string) {
    onChange(
      selected.map((s) => ({
        ...s,
        role: s.agent_id === agentId ? "primary" as const : "helper" as const,
      }))
    );
  }

  let buttonLabel = "Unassigned";
  if (selected.length === 1) {
    const agent = agents.find((a) => a.id === selected[0].agent_id);
    buttonLabel = agent?.name ?? "1 agent";
  } else if (selected.length > 1) {
    buttonLabel = `${selected.length} agents`;
  }

  const dropdownContent = open ? createPortal(
    <div
      id="agent-multi-dropdown"
      style={dropdownStyle}
      className="rounded-[2px] border border-mac-black bg-mac-white shadow-[2px_2px_0px_#000]"
    >
      {agents.length === 0 ? (
        <div className="px-3 py-2 text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
          No agents available
        </div>
      ) : (
        <>
          <div className="max-h-[240px] overflow-y-auto">
            {agents.map((agent) => {
              const checked = selectedIds.has(agent.id);
              const isPrimary = agent.id === primaryId;
              return (
                <div
                  key={agent.id}
                  className="flex cursor-pointer items-center gap-2 px-3 py-1.5 hover:bg-mac-highlight hover:text-mac-highlight-text transition-colors"
                >
                  <label className="flex items-center gap-2 flex-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleAgent(agent.id)}
                      className="accent-mac-black"
                    />
                    <span className="text-sm font-[family-name:var(--font-pixel)] truncate">
                      {agent.name}
                    </span>
                  </label>
                  {checked && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPrimary(agent.id);
                      }}
                      className={`text-sm shrink-0 ${
                        isPrimary
                          ? "text-amber-500"
                          : "text-mac-gray hover:text-amber-400"
                      }`}
                      title={isPrimary ? "Primary agent" : "Set as primary"}
                    >
                      ★
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-mac-black px-3 py-1.5">
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-xs text-mac-dark-gray hover:text-mac-black font-[family-name:var(--font-pixel)]"
              >
                Clear all
              </button>
            </div>
          )}
        </>
      )}
    </div>,
    document.body
  ) : null;

  return (
    <div ref={ref} className="relative">
      {label && (
        <label className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
          {label}
        </label>
      )}
      <button
        ref={buttonRef}
        type="button"
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        className="inline-flex items-center justify-between w-full gap-1 rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[1px_1px_0px_#000] active:shadow-none active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span className="truncate">{buttonLabel}</span>
        <span className="ml-1 text-[10px] shrink-0">&#9660;</span>
      </button>
      {dropdownContent}
    </div>
  );
}
