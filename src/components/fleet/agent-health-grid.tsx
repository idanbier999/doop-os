"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthSparkline } from "@/components/agents/health-sparkline";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { useWorkspace } from "@/contexts/workspace-context";
import { relativeTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";

type Agent = Omit<Tables<"agents">, "api_key_hash">;

interface AgentHealthGridProps {
  initialAgents: Agent[];
  agentCurrentTask: Record<string, string>;
  agentHealthHistory: Record<string, Array<{ health: string | null; created_at: string | null }>>;
}

const HEALTH_ORDER = ["critical", "degraded", "offline", "healthy"] as const;

const healthBandColors: Record<string, string> = {
  critical: "bg-health-critical",
  degraded: "bg-health-degraded",
  offline: "bg-health-offline",
  healthy: "bg-health-healthy",
};

function sortAgents(agents: Agent[]): Agent[] {
  const orderMap: Record<string, number> = { critical: 0, degraded: 1, offline: 2, healthy: 3 };
  return [...agents].sort((a, b) => {
    const oa = orderMap[a.health] ?? 4;
    const ob = orderMap[b.health] ?? 4;
    if (oa !== ob) return oa - ob;
    // Within same health, sort by lastSeenAt desc
    if (!a.lastSeenAt && !b.lastSeenAt) return 0;
    if (!a.lastSeenAt) return 1;
    if (!b.lastSeenAt) return -1;
    return new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime();
  });
}

function getAgentStatusLine(agent: Agent, currentTasks: Record<string, string>): string {
  const task = currentTasks[agent.id];
  if (task) return `Working on: ${task}`;
  if (agent.health === "offline") {
    const ago = relativeTime(agent.lastSeenAt);
    return `Offline · ${ago}`;
  }
  return "Idle";
}

export function AgentHealthGrid({
  initialAgents,
  agentCurrentTask,
  agentHealthHistory,
}: AgentHealthGridProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);
  const [currentTasks, setCurrentTasks] = useState<Record<string, string>>(agentCurrentTask);
  const { workspaceId } = useWorkspace();
  const router = useRouter();

  const handleAgentEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      setAgents((prev) => {
        if (event.event === "INSERT" && event.new) {
          const newAgent = event.new as unknown as Agent;
          if (prev.some((a) => a.id === newAgent.id)) return prev;
          return [...prev, newAgent];
        }
        if (event.event === "UPDATE" && event.new) {
          const updated = event.new as unknown as Agent;
          return prev.map((a) => (a.id === updated.id ? updated : a));
        }
        if (event.event === "DELETE" && event.old) {
          const deleted = event.old as unknown as Agent;
          return prev.filter((a) => a.id !== deleted.id);
        }
        return prev;
      });
    },
    []
  );

  const handleTaskEvent = useCallback(() => {
    // Re-fetch the page to get updated current tasks from server
    router.refresh();
  }, [router]);

  useRealtimeEvents({ table: "agents", onEvent: handleAgentEvent });
  useRealtimeEvents({ table: "tasks", onEvent: handleTaskEvent });

  if (agents.length === 0) {
    return (
      <Card title="Agent Fleet">
        <EmptyState
          message="No agents registered"
          description="Connect your first agent to see real-time health and status here."
          actionLabel="Go to Agents"
          onAction={() => router.push("/dashboard/agents")}
        />
      </Card>
    );
  }

  const sorted = sortAgents(agents);

  return (
    <Card title="Agent Fleet">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4">
        {sorted.map((agent) => {
          const bandClass = healthBandColors[agent.health] ?? "bg-mac-gray";
          const history = agentHealthHistory[agent.id] ?? [];
          const statusLine = getAgentStatusLine(agent, currentTasks);

          return (
            <Link
              key={agent.id}
              href={`/dashboard/agents/${agent.id}`}
              className="block border border-mac-border rounded-lg bg-mac-white overflow-hidden hover:shadow-md transition-all duration-200"
            >
              {/* Health color band */}
              <div className={`h-1.5 ${bandClass} transition-colors duration-300`} />

              <div className="px-3 py-2.5">
                {/* Name + type */}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-mac-black truncate">{agent.name}</span>
                  {agent.agentType && (
                    <Badge variant="stage" value="idle" className="shrink-0">
                      {agent.agentType}
                    </Badge>
                  )}
                </div>

                {/* Status line */}
                <p className="mt-1 text-xs text-mac-gray font-[family-name:var(--font-pixel)] truncate">
                  {statusLine}
                </p>

                {/* Last seen + sparkline */}
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-mac-gray font-[family-name:var(--font-pixel)]">
                    {relativeTime(agent.lastSeenAt)}
                  </span>
                  {history.length > 0 && (
                    <HealthSparkline
                      updates={history}
                      currentHealth={agent.health}
                      width={80}
                      height={24}
                      strokeWidth={1}
                    />
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
