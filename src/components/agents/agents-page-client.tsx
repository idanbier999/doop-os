"use client";

import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";
import { AgentCard } from "@/components/dashboard/agent-card";
import { TagFilter } from "./tag-filter";
import { EmptyState } from "@/components/ui/empty-state";
import { useFleetScopeFilter } from "@/hooks/use-fleet-scope-filter";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { createAgent } from "@/app/dashboard/agents/actions";
import type { Tables } from "@/lib/database.types";

type Agent = Omit<Tables<"agents">, "api_key">;

interface AgentsPageClientProps {
  initialAgents: Agent[];
  agentStats?: Record<string, { completionRate: number; openProblems: number }>;
  ownerNames?: Record<string, string>;
}

export function AgentsPageClient({ initialAgents, agentStats, ownerNames }: AgentsPageClientProps) {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const scopedAgents = useFleetScopeFilter(agents);
  const [stageFilter, setStageFilter] = useState("");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [connectModalOpen, setConnectModalOpen] = useState(false);

  // Modal state
  const [modalStep, setModalStep] = useState<"form" | "result">("form");
  const [agentName, setAgentName] = useState("");
  const [platform, setPlatform] = useState<"openclaw" | "mcp">("openclaw");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdAgent, setCreatedAgent] = useState<{
    agentId: string;
    apiKey: string;
    apiKeyLast4: string;
    name: string;
    platform: string | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  function resetModal() {
    setModalStep("form");
    setAgentName("");
    setPlatform("openclaw");
    setCreating(false);
    setCreateError(null);
    setCreatedAgent(null);
    setCopied(false);
  }

  function handleModalClose() {
    setConnectModalOpen(false);
    resetModal();
    router.refresh();
  }

  async function handleCreateAgent() {
    if (!agentName.trim() || !workspaceId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const result = await createAgent(workspaceId, agentName.trim(), platform);
      if (result.success) {
        setCreatedAgent({
          agentId: result.agentId!,
          apiKey: result.apiKey!,
          apiKeyLast4: result.apiKeyLast4!,
          name: result.name!,
          platform: result.platform ?? null,
        });
        setModalStep("result");
      } else {
        setCreateError(result.error ?? "Failed to create agent");
      }
    } catch {
      setCreateError("An unexpected error occurred");
    } finally {
      setCreating(false);
    }
  }

  function getConfigSnippet(): string {
    if (!createdAgent) return "";
    if (platform === "openclaw") {
      const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
      return JSON.stringify(
        {
          TARELY_API_BASE_URL: baseUrl,
          TARELY_AGENT_API_KEY: createdAgent.apiKey,
          TARELY_AGENT_ID: createdAgent.agentId,
        },
        null,
        2
      );
    }
    return JSON.stringify(
      {
        mcpServers: {
          tarely: {
            command: "node",
            args: ["path/to/tarely-mcp/build/index.js"],
            env: {
              TARELY_API_KEY: createdAgent.apiKey,
            },
          },
        },
      },
      null,
      2
    );
  }

  async function handleCopyConfig() {
    try {
      await navigator.clipboard.writeText(getConfigSnippet());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may fail in some environments
    }
  }

  const handleRealtimePayload = useCallback(
    (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (payload.eventType === "INSERT") {
        const newAgent = payload.new as unknown as Agent;
        if (newAgent.workspace_id === workspaceId) {
          setAgents(prev => [...prev, newAgent].sort((a, b) => a.name.localeCompare(b.name)));
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as Agent;
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
    scopedAgents.forEach(a => a.tags?.forEach(t => tagSet.add(t)));
    return Array.from(tagSet).sort();
  }, [scopedAgents]);

  const stages = useMemo(() => {
    const stageSet = new Set<string>();
    scopedAgents.forEach(a => stageSet.add(a.stage));
    return Array.from(stageSet).sort();
  }, [scopedAgents]);

  const filteredAgents = useMemo(() => {
    return scopedAgents.filter(a => {
      if (stageFilter && a.stage !== stageFilter) return false;
      if (selectedTags.length > 0) {
        if (!a.tags || !selectedTags.some(t => a.tags!.includes(t))) return false;
      }
      return true;
    });
  }, [scopedAgents, stageFilter, selectedTags]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
          Agents
        </h1>
        <Button variant="primary" onClick={() => setConnectModalOpen(true)}>
          Connect Agent
        </Button>
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

      {agents.length === 0 ? (
        <EmptyState
          message="No agents found"
          description="No agents registered yet. Agents connect via MCP."
          actionLabel="Connect Agent"
          onAction={() => setConnectModalOpen(true)}
        />
      ) : scopedAgents.length === 0 ? (
        <EmptyState
          message="No agents in your fleet"
          description="Switch to All Fleet or connect a new agent."
        />
      ) : filteredAgents.length === 0 ? (
        <EmptyState
          message="No agents match the current filters"
          description="Try adjusting your filters."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredAgents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              completionRate={agentStats?.[agent.id]?.completionRate}
              openProblems={agentStats?.[agent.id]?.openProblems}
              ownerName={ownerNames?.[agent.id]}
            />
          ))}
        </div>
      )}

      <Modal open={connectModalOpen} onClose={handleModalClose} title="Connect a New Agent">
        {modalStep === "form" ? (
          <div className="space-y-4">
            <div>
              <label htmlFor="agent-name" className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
                Agent Name
              </label>
              <input
                id="agent-name"
                type="text"
                value={agentName}
                onChange={e => setAgentName(e.target.value)}
                placeholder="e.g. my-research-agent"
                className="w-full rounded-[2px] border border-mac-black bg-mac-white px-3 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
                onKeyDown={e => {
                  if (e.key === "Enter" && agentName.trim() && !creating) {
                    handleCreateAgent();
                  }
                }}
              />
            </div>

            <div>
              <label htmlFor="agent-platform" className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
                Platform
              </label>
              <select
                id="agent-platform"
                value={platform}
                onChange={e => setPlatform(e.target.value as "openclaw" | "mcp")}
                className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
              >
                <option value="openclaw">OpenClaw</option>
                <option value="mcp">MCP (Claude/Cursor)</option>
              </select>
            </div>

            {createError && (
              <p className="text-sm text-severity-critical">{createError}</p>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={handleModalClose}>
                Cancel
              </Button>
              <Button
                variant="primary"
                disabled={creating || !agentName.trim()}
                onClick={handleCreateAgent}
              >
                {creating ? "Creating..." : "Create Agent"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1">
              <p className="text-sm text-mac-dark-gray">
                <span className="font-bold text-mac-black">Agent:</span> {createdAgent?.name}
              </p>
              <p className="text-sm text-mac-dark-gray">
                <span className="font-bold text-mac-black">ID:</span>{" "}
                <code className="text-xs font-mono bg-mac-light-gray px-1 py-0.5 rounded">{createdAgent?.agentId}</code>
              </p>
            </div>

            <div className="rounded-lg border border-amber-400 bg-amber-50 px-3 py-2">
              <p className="text-sm font-bold text-amber-800 font-[family-name:var(--font-pixel)]">
                API Key (shown once)
              </p>
              <p className="mt-1 font-mono text-sm text-amber-900 break-all select-all">
                {createdAgent?.apiKey}
              </p>
              <p className="mt-1 text-xs text-amber-700">
                This key is shown once. Store it safely.
              </p>
            </div>

            <div className="relative">
              <pre className="rounded-lg bg-zinc-900 text-zinc-100 p-4 text-sm font-mono overflow-x-auto">
                {getConfigSnippet()}
              </pre>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyConfig}
                className="absolute top-2 right-2"
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            </div>

            <div className="flex justify-end">
              <Button variant="secondary" onClick={handleModalClose}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
