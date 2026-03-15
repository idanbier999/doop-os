"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface TimelineProps {
  agentId: string;
  initialUpdates: Tables<"agent_updates">[];
}

export function Timeline({ agentId, initialUpdates }: TimelineProps) {
  const [updates, setUpdates] = useState<Tables<"agent_updates">[]>(initialUpdates);

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newUpdate = payload.new as Tables<"agent_updates">;
        if (newUpdate.agent_id === agentId) {
          setUpdates((prev) => [newUpdate, ...prev]);
        }
      }
    },
    [agentId]
  );

  useRealtime({
    table: "agent_updates",
    filter: `agent_id=eq.${agentId}`,
    onPayload: handlePayload,
  });

  return (
    <Card>
      <CardHeader>
        <h2 className="text-sm font-semibold text-mac-black">Timeline</h2>
      </CardHeader>
      <CardBody className="p-0">
        {updates.length === 0 ? (
          <EmptyState
            message="Waiting for first status update"
            description="Waiting for first status update from this agent"
          />
        ) : (
          <ul className="divide-y divide-mac-border">
            {updates.map((update) => (
              <li key={update.id} className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {update.stage && <Badge variant="stage" value={update.stage} />}
                  {update.health && <Badge variant="health" value={update.health} />}
                  <span className="ml-auto text-xs text-mac-dark-gray">
                    {relativeTime(update.created_at)}
                  </span>
                </div>
                {update.message && (
                  <p className="mt-1 text-sm text-mac-dark-gray">{update.message}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
