"use client";

import { useState, useCallback } from "react";
import { useRealtime } from "@/hooks/use-realtime";
import { useWorkspace } from "@/contexts/workspace-context";
import { useSupabase } from "@/hooks/use-supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

interface AgentProblemsPanelProps {
  agentId: string;
  initialProblems: Tables<"problems">[];
}

export function AgentProblemsPanel({
  agentId,
  initialProblems,
}: AgentProblemsPanelProps) {
  const [problems, setProblems] =
    useState<Tables<"problems">[]>(initialProblems);
  const [loading, setLoading] = useState<string | null>(null);
  const { userId, workspaceId } = useWorkspace();
  const supabase = useSupabase();

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newProblem = payload.new as Tables<"problems">;
        if (newProblem.agent_id === agentId) {
          setProblems((prev) => [newProblem, ...prev]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Tables<"problems">;
        setProblems((prev) =>
          prev.map((p) => (p.id === updated.id ? updated : p))
        );
      }
    },
    [agentId]
  );

  useRealtime({
    table: "problems",
    filter: `agent_id=eq.${agentId}`,
    onPayload: handlePayload,
  });

  const updateStatus = async (
    problemId: string,
    status: string
  ) => {
    setLoading(problemId);
    const updateData: Record<string, string> = { status };
    if (status === "resolved" || status === "dismissed") {
      updateData.resolved_by = userId;
      updateData.resolved_at = new Date().toISOString();
    }
    await supabase.from("problems").update(updateData).eq("id", problemId);
    const problem = problems.find(p => p.id === problemId);
    await supabase.from("activity_log").insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      user_id: userId,
      action: `problem_${status}`,
      details: { problem_id: problemId, title: problem?.title },
    });
    setLoading(null);
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-mac-black">Problems</h2>
          <span className="text-xs text-mac-dark-gray">
            {problems.filter((p) => p.status === "open").length} open
          </span>
        </div>
      </CardHeader>
      <CardBody className="p-0">
        {problems.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-mac-dark-gray">
            No problems reported
          </p>
        ) : (
          <ul className="divide-y divide-mac-border">
            {problems.map((problem) => (
              <li key={problem.id} className="px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant="severity" value={problem.severity} />
                      <Badge variant="status" value={problem.status} />
                    </div>
                    <p className="mt-1 text-sm font-medium text-mac-black">
                      {problem.title}
                    </p>
                    {problem.description && (
                      <p className="mt-0.5 text-xs text-mac-gray line-clamp-2">
                        {problem.description}
                      </p>
                    )}
                    <p className="mt-1 text-xs text-mac-dark-gray">
                      {relativeTime(problem.created_at)}
                    </p>
                  </div>
                  {problem.status === "open" && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === problem.id}
                        onClick={() =>
                          updateStatus(problem.id, "acknowledged")
                        }
                      >
                        Ack
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === problem.id}
                        onClick={() =>
                          updateStatus(problem.id, "resolved")
                        }
                      >
                        Resolve
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === problem.id}
                        onClick={() =>
                          updateStatus(problem.id, "dismissed")
                        }
                      >
                        Dismiss
                      </Button>
                    </div>
                  )}
                  {problem.status === "acknowledged" && (
                    <div className="flex shrink-0 gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={loading === problem.id}
                        onClick={() =>
                          updateStatus(problem.id, "resolved")
                        }
                      >
                        Resolve
                      </Button>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
