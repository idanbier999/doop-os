"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { useRealtime } from "@/hooks/use-realtime";
import type { Tables } from "@/lib/database.types";

type Agent = Omit<Tables<"agents">, "api_key">;

interface AgentHealthGridProps {
  initialAgents: Agent[];
}

const HEALTH_ORDER = ["critical", "degraded", "offline", "healthy"] as const;

const healthColors: Record<string, string> = {
  critical: "var(--color-health-critical)",
  degraded: "var(--color-health-degraded)",
  offline: "var(--color-health-offline)",
  healthy: "var(--color-health-healthy)",
};

const healthDotClasses: Record<string, string> = {
  healthy: "bg-health-healthy",
  degraded: "bg-health-degraded",
  critical: "bg-health-critical",
  offline: "bg-health-offline",
};

function isStale(lastSeenAt: string | null): boolean {
  if (!lastSeenAt) return true;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  return new Date(lastSeenAt).getTime() < oneHourAgo;
}

function sortByLastSeen(a: Agent, b: Agent): number {
  if (!a.last_seen_at && !b.last_seen_at) return 0;
  if (!a.last_seen_at) return 1;
  if (!b.last_seen_at) return -1;
  return new Date(b.last_seen_at).getTime() - new Date(a.last_seen_at).getTime();
}

export function AgentHealthGrid({ initialAgents }: AgentHealthGridProps) {
  const [agents, setAgents] = useState<Agent[]>(initialAgents);

  const handleRealtimeChange = useCallback(
    (payload: { eventType: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
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

  useRealtime({ table: "agents", onPayload: handleRealtimeChange });

  const grouped = new Map<string, Agent[]>();
  for (const health of HEALTH_ORDER) {
    grouped.set(health, []);
  }
  for (const agent of agents) {
    const bucket = grouped.get(agent.health) ?? [];
    bucket.push(agent);
    grouped.set(agent.health, bucket);
  }

  if (agents.length === 0) {
    return (
      <Card title="Agent Fleet">
        <p className="text-sm text-mac-gray py-8 text-center">
          No agents registered — connect your first agent via MCP
        </p>
      </Card>
    );
  }

  return (
    <Card title="Agent Fleet">
      <div className="space-y-4">
        {HEALTH_ORDER.map((health) => {
          const group = grouped.get(health) ?? [];
          if (group.length === 0) return null;
          const sorted = [...group].sort(sortByLastSeen);
          return (
            <div key={health}>
              <h3
                className="font-[family-name:var(--font-pixel)] text-lg mb-2"
                style={{ color: healthColors[health] }}
              >
                {health.charAt(0).toUpperCase() + health.slice(1)} ({group.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                {sorted.map((agent) => {
                  const stale = isStale(agent.last_seen_at);
                  return (
                    <Link
                      key={agent.id}
                      href={`/dashboard/agents/${agent.id}`}
                      className={`flex items-center gap-2 p-2 rounded hover:bg-mac-light-gray cursor-pointer ${
                        stale ? "opacity-50" : ""
                      }`}
                    >
                      <span
                        className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                          healthDotClasses[agent.health] ?? "bg-mac-gray"
                        }`}
                      />
                      <span className="truncate text-sm text-mac-black">
                        {agent.name}
                        {agent.agent_type && (
                          <span className="text-mac-gray"> ({agent.agent_type})</span>
                        )}
                        {stale && (
                          <span className="text-mac-gray"> (stale)</span>
                        )}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
