import { useMemo } from "react";
import { useWorkspace } from "@/contexts/workspace-context";

export function useFleetScopeFilter<T extends { owner_id?: string | null }>(items: T[]): T[] {
  const { fleetScope, userId } = useWorkspace();
  return useMemo(() => {
    if (fleetScope === "all") return items;
    return items.filter((item) => item.owner_id === userId);
  }, [items, fleetScope, userId]);
}

export function useOwnedAgentIds(
  agents: Array<{ id: string; owner_id?: string | null }>
): Set<string> {
  const { fleetScope, userId } = useWorkspace();
  return useMemo(() => {
    if (fleetScope === "all") return new Set(agents.map((a) => a.id));
    return new Set(agents.filter((a) => a.owner_id === userId).map((a) => a.id));
  }, [agents, fleetScope, userId]);
}
