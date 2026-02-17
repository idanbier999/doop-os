"use client";

import { useState, useCallback, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNotifications } from "@/contexts/notification-context";
import { useRealtime } from "@/hooks/use-realtime";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Problem = Tables<"problems"> & { agents?: { name: string } | null };

interface TaskProblemsProps {
  taskId: string;
}

export function TaskProblems({ taskId }: TaskProblemsProps) {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { userId, workspaceId } = useWorkspace();
  const { addToast } = useNotifications();

  useEffect(() => {
    let cancelled = false;
    async function fetchProblems() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("problems")
        .select("*, agents(name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false });
      if (!cancelled) {
        setProblems((data as Problem[]) ?? []);
        setLoading(false);
      }
    }
    fetchProblems();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newProblem = payload.new as unknown as Problem;
        if (newProblem.task_id === taskId) {
          setProblems((prev) => [newProblem, ...prev]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as Problem;
        setProblems((prev) =>
          prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p))
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as { id: string };
        setProblems((prev) => prev.filter((p) => p.id !== deleted.id));
      }
    },
    [taskId]
  );

  useRealtime({
    table: "problems",
    filter: `task_id=eq.${taskId}`,
    onPayload: handlePayload,
  });

  const updateStatus = async (problemId: string, status: string) => {
    setActionLoading(problemId);
    try {
      const supabase = createClient();
      const updateData: Record<string, string> = { status };
      if (status === "resolved" || status === "dismissed") {
        updateData.resolved_by = userId;
        updateData.resolved_at = new Date().toISOString();
      }
      await supabase.from("problems").update(updateData).eq("id", problemId);
      const problem = problems.find((p) => p.id === problemId);
      await supabase.from("activity_log").insert({
        workspace_id: workspaceId,
        agent_id: problem?.agent_id ?? null,
        user_id: userId,
        action: `problem_${status}`,
        details: { problem_id: problemId, task_id: taskId, title: problem?.title },
      });
    } catch {
      addToast({ type: "warning", title: "Failed to update problem", description: "Please try again" });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-4 font-[family-name:var(--font-pixel)]">
      {loading && (
        <p className="text-sm text-mac-gray text-center py-4">Loading problems...</p>
      )}
      {!loading && problems.length === 0 && (
        <p className="text-sm text-mac-gray text-center py-4">
          No problems linked to this task
        </p>
      )}
      <ul className="space-y-3">
        {problems.map((problem) => (
          <li
            key={problem.id}
            className="border border-mac-black bg-mac-white p-3"
          >
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="severity" value={problem.severity} />
              <Badge variant="status" value={problem.status} />
            </div>
            <p className="text-sm font-bold text-mac-black">{problem.title}</p>
            {problem.description && (
              <p className="text-xs text-mac-dark-gray mt-0.5 line-clamp-2">
                {problem.description}
              </p>
            )}
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-mac-gray">
                {problem.agents?.name ?? "Unknown agent"} -- {relativeTime(problem.created_at)}
              </span>
              <div className="flex gap-1">
                {problem.status === "open" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionLoading === problem.id}
                      onClick={() => updateStatus(problem.id, "acknowledged")}
                    >
                      Ack
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionLoading === problem.id}
                      onClick={() => updateStatus(problem.id, "resolved")}
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionLoading === problem.id}
                      onClick={() => updateStatus(problem.id, "dismissed")}
                    >
                      Dismiss
                    </Button>
                  </>
                )}
                {problem.status === "acknowledged" && (
                  <>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionLoading === problem.id}
                      onClick={() => updateStatus(problem.id, "resolved")}
                    >
                      Resolve
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={actionLoading === problem.id}
                      onClick={() => updateStatus(problem.id, "dismissed")}
                    >
                      Dismiss
                    </Button>
                  </>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
