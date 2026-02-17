"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AgentTags } from "@/components/agents/agent-tags";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

const healthDotColors: Record<string, string> = {
  healthy: "bg-health-healthy",
  degraded: "bg-health-degraded",
  critical: "bg-health-critical",
  offline: "bg-health-offline",
};

interface AgentCardProps {
  agent: Tables<"agents">;
}

export function AgentCard({ agent }: AgentCardProps) {
  return (
    <Link
      href={`/dashboard/agents/${agent.id}`}
      className="block rounded-lg border border-gray-800 bg-gray-900 p-3 transition-colors hover:border-gray-700 hover:bg-gray-800/50"
    >
      <div className="flex items-center gap-2">
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${healthDotColors[agent.health] || "bg-gray-600"}`}
        />
        <span className="truncate text-sm font-medium text-gray-100">
          {agent.name}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {agent.agent_type && (
          <Badge variant="stage" value={agent.agent_type} />
        )}
        <span className="text-xs text-gray-500">
          {relativeTime(agent.last_seen_at)}
        </span>
      </div>
      {agent.tags && agent.tags.length > 0 && (
        <div className="mt-1.5">
          <AgentTags tags={agent.tags} size="sm" maxVisible={3} />
        </div>
      )}
    </Link>
  );
}
