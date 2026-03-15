"use client";

import { useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { AgentHealthGrid } from "@/components/fleet/agent-health-grid";
import {
  OperatorFleetSummary,
  type OperatorGroup,
} from "@/components/fleet/operator-fleet-summary";
import type { Tables } from "@/lib/database.types";

type Agent = Omit<Tables<"agents">, "api_key">;

interface FleetPageClientProps {
  agents: Agent[];
  operatorGroups: OperatorGroup[];
  agentCurrentTask: Record<string, string>;
  agentHealthHistory: Record<string, Array<{ health: string | null; created_at: string | null }>>;
  userRole: string;
}

export function FleetPageClient({
  agents,
  operatorGroups,
  agentCurrentTask,
  agentHealthHistory,
  userRole,
}: FleetPageClientProps) {
  const { fleetScope } = useWorkspace();
  const [selectedOperatorId, setSelectedOperatorId] = useState<string | null | undefined>(
    undefined
  );

  const showOperatorSummary =
    fleetScope === "all" && (userRole === "owner" || userRole === "admin");

  const filteredAgents =
    selectedOperatorId !== undefined
      ? agents.filter((a) => a.owner_id === selectedOperatorId)
      : agents;

  return (
    <>
      {showOperatorSummary && (
        <OperatorFleetSummary
          operators={operatorGroups}
          selectedOperatorId={selectedOperatorId}
          onSelectOperator={setSelectedOperatorId}
          onClearFilter={() => setSelectedOperatorId(undefined)}
        />
      )}
      <AgentHealthGrid
        key={selectedOperatorId ?? "all"}
        initialAgents={filteredAgents}
        agentCurrentTask={agentCurrentTask}
        agentHealthHistory={agentHealthHistory}
      />
    </>
  );
}
