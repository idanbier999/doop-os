"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AgentTags } from "@/components/agents/agent-tags";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

type Agent = Omit<Tables<"agents">, "api_key">;

const healthDotColors: Record<string, string> = {
  healthy: "bg-health-healthy",
  degraded: "bg-health-degraded",
  critical: "bg-health-critical",
  offline: "bg-health-offline",
};

interface AgentCardProps {
  agent: Agent;
  completionRate?: number;
  openProblems?: number;
}

export function AgentCard({ agent, completionRate, openProblems }: AgentCardProps) {
  return (
    <Link
      href={`/dashboard/agents/${agent.id}`}
      className="block rounded-lg border border-mac-border bg-mac-white p-3 transition-colors hover:border-mac-border hover:bg-mac-highlight-soft/50"
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthDotColors[agent.health] || "bg-mac-gray"}`}
        />
        <span className="truncate text-sm font-medium text-mac-black">{agent.name}</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {agent.agent_type && <Badge variant="stage" value={agent.agent_type} />}
        <span className="text-xs text-mac-dark-gray">{relativeTime(agent.last_seen_at)}</span>
      </div>
      {(completionRate !== undefined || (openProblems !== undefined && openProblems > 0)) && (
        <div className="mt-2 flex items-center gap-3 text-xs">
          {completionRate !== undefined && (
            <span className="text-mac-dark-gray font-[family-name:var(--font-pixel)]">
              {completionRate}% completion
            </span>
          )}
          {openProblems !== undefined && openProblems > 0 && (
            <span
              style={{ color: "var(--color-health-critical)" }}
              className="font-[family-name:var(--font-pixel)]"
            >
              {openProblems} open problem{openProblems !== 1 ? "s" : ""}
            </span>
          )}
        </div>
      )}
      {agent.tags && agent.tags.length > 0 && (
        <div className="mt-1.5">
          <AgentTags tags={agent.tags} size="sm" maxVisible={3} />
        </div>
      )}
    </Link>
  );
}
