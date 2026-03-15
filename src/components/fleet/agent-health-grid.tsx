"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { HealthSparkline } from "@/components/agents/health-sparkline";
import { useRealtime } from "@/hooks/use-realtime";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { relativeTime } from "@/lib/utils";
import { EmptyState } from "@/components/ui/empty-state";
import type { Tables } from "@/lib/database.types";

type Agent = Omit<Tables<"agents">, "api_key">;

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
    // Within same health, sort by last_seen desc
    if (!a.last_seen_at && !b.last_seen_at) return 0;
    if (!a.last_seen_at) return 1;
    if (!b.last_seen_at) return -1;
    return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
  });
}

function getAgentStatusLine(agent: Agent, currentTasks: Record<string, string>): string {
  const task = currentTasks[agent.id];
  if (task) return `Working on: ${task}`;
  if (agent.health === "offline") {
    const ago = relativeTime(agent.last_seen_at);
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
  const supabase = useSupabase();
  const router = useRouter();

  const handleRealtimeChange = useCallback(
    (payload: {
      eventType: string;
      new?: Record<string, unknown>;
      old?: Record<string, unknown>;
    }) => {
      setAgents((prev) => {
        if (payload.eventType === "INSERT" && payload.new) {
          const newAgent = payload.new as unknown as Agent;
          if (prev.some((a) => a.id === newAgent.id)) return prev;
          return [...prev, newAgent];
        }
        if (payload.eventType === "UPDATE" && payload.new) {
          const updated = payload.new as unknown as Agent;
          return prev.map((a) => (a.id === updated.id ? updated : a));
        }
        if (payload.eventType === "DELETE" && payload.old) {
          const deleted = payload.old as unknown as Agent;
          return prev.filter((a) => a.id !== deleted.id);
        }
        return prev;
      });
    },
    []
  );

  const refetchCurrentTasks = useCallback(async () => {
    const agentIds = agents.map((a) => a.id);
    if (agentIds.length === 0) return;

    const { data } = await supabase
      .from("tasks")
      .select("agent_id, title")
      .in("agent_id", agentIds)
      .in("status", ["in_progress", "waiting_on_agent"]);

    if (data) {
      const map: Record<string, string> = {};
      for (const t of data) {
        if (t.agent_id) map[t.agent_id] = t.title;
      }
      setCurrentTasks(map);
    }
  }, [agents, supabase]);

  useRealtime({ table: "agents", onPayload: handleRealtimeChange });
  useRealtime({ table: "tasks", onPayload: refetchCurrentTasks });

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
                  {agent.agent_type && (
                    <Badge variant="stage" value="idle" className="shrink-0">
                      {agent.agent_type}
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
                    {relativeTime(agent.last_seen_at)}
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
