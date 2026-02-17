"use client";

import { useState, useMemo, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";
import { AgentCard } from "@/components/dashboard/agent-card";
import { TagFilter } from "./tag-filter";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";

interface AgentsPageClientProps {
  initialAgents: Tables<"agents">[];
}

export function AgentsPageClient({ initialAgents }: AgentsPageClientProps) {
  const { workspaceId } = useWorkspace();
  const [agents, setAgents] = useState(initialAgents);
  const [stageFilter, setStageFilter] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const handleRealtimePayload = useCallback(
    (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (payload.eventType === "INSERT") {
        const newAgent = payload.new as unknown as Tables<"agents">;
        if (newAgent.workspace_id === workspaceId) {
          setAgents(prev => [...prev, newAgent].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as Tables<"agents">;
        setAgents(prev => prev.map(a => a.id === updated.id ? updated : a));
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as { id: string };
        setAgents(prev => prev.filter(a => a.id !== deleted.id));
      }
    },
    [workspaceId]
  );

  useRealtime({
    table: "agents",
    filter: `workspace_id=eq.${workspaceId}`,
    onPayload: handleRealtimePayload,
  });

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    agents.forEach(a => a.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [agents]);

  const stages = useMemo(() => {
    const stageSet = new Set<string>();
    agents.forEach(a => stageSet.add(a.stage));
    return Array.from(stageSet).sort();
  }, [agents]);

  const filteredAgents = useMemo(() => {
    return agents.filter(a => {
      if (stageFilter && a.stage !== stageFilter) return false;
      if (selectedTags.length > 0) {
        if (!a.tags || !selectedTags.some(t => a.tags!.includes(t))) return false;
      }
      return true;
    });
  }, [agents, stageFilter, selectedTags]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
          Agents
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
        >
          <option value="">All Stages</option>
          {stages.map(s => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
        <TagFilter
          availableTags={availableTags}
          selectedTags={selectedTags}
          onChange={setSelectedTags}
        />
      </div>

      {filteredAgents.length === 0 ? (
        <EmptyState
          message="No agents found"
          description={
            agents.length === 0
              ? "No agents registered yet. Agents connect via MCP."
              : "No agents match the current filters."
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map(agent => (
            <AgentCard key={agent.id} agent={agent} />
          ))}
        </div>
      )}
    </div>
  );
}
