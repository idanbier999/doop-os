import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

const healthDotColors: Record<string, string> = {
  healthy: "bg-health-healthy",
  degraded: "bg-health-degraded",
  critical: "bg-health-critical",
  offline: "bg-health-offline",
};

interface StatusHeaderProps {
  agent: Tables<"agents">;
}

export function StatusHeader({ agent }: StatusHeaderProps) {
  return (
    <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${healthDotColors[agent.health] || "bg-gray-600"}`}
            />
            <h1 className="text-xl font-bold text-gray-100">{agent.name}</h1>
          </div>
          {agent.description && (
            <p className="mt-2 text-sm text-gray-400">{agent.description}</p>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant="stage" value={agent.stage} />
        <Badge variant="health" value={agent.health} />
        {agent.agent_type && (
          <span className="rounded-full bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-300">
            {agent.agent_type}
          </span>
        )}
        <span className="text-xs text-gray-500">
          Last seen: {relativeTime(agent.last_seen_at)}
        </span>
      </div>
    </div>
  );
}
