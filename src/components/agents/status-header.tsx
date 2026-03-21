import { Badge } from "@/components/ui/badge";
import { AgentTags } from "@/components/agents/agent-tags";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

type Agent = Omit<Tables<"agents">, "api_key_hash">;

const healthDotColors: Record<string, string> = {
  healthy: "bg-health-healthy",
  degraded: "bg-health-degraded",
  critical: "bg-health-critical",
  offline: "bg-health-offline",
};

interface StatusHeaderProps {
  agent: Agent;
}

export function StatusHeader({ agent }: StatusHeaderProps) {
  return (
    <div className="rounded-lg border border-mac-border bg-mac-white p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span
              className={`h-3 w-3 shrink-0 rounded-full ${healthDotColors[agent.health] || "bg-mac-gray"}`}
            />
            <h1 className="text-xl font-bold text-mac-black">{agent.name}</h1>
          </div>
          {agent.description && <p className="mt-2 text-sm text-mac-gray">{agent.description}</p>}
          {agent.tags && agent.tags.length > 0 && (
            <div className="mt-2">
              <AgentTags tags={agent.tags} size="md" />
            </div>
          )}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Badge variant="stage" value={agent.stage} />
        <Badge variant="health" value={agent.health} />
        {agent.agentType && (
          <span className="rounded-full bg-mac-white px-2.5 py-0.5 text-xs font-medium text-mac-dark-gray">
            {agent.agentType}
          </span>
        )}
        <span className="text-xs text-mac-dark-gray">
          Last seen: {relativeTime(agent.lastSeenAt)}
        </span>
      </div>
    </div>
  );
}
