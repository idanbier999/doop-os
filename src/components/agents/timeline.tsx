"use client";

import { useState, useCallback } from "react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

interface TimelineProps {
  agentId: string;
  initialUpdates: Tables<"agent_updates">[];
}

export function Timeline({ agentId, initialUpdates }: TimelineProps) {
  const [updates, setUpdates] = useState<Tables<"agent_updates">[]>(initialUpdates);

  const handleEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const newUpdate = event.new as Tables<"agent_updates">;
        if (newUpdate.agentId === agentId) {
          setUpdates((prev) => [newUpdate, ...prev]);
        }
      }
    },
    [agentId]
  );

  useRealtimeEvents({
    table: "agent_updates",
    onEvent: handleEvent,
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
                    {relativeTime(update.createdAt)}
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
