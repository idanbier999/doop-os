"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNotifications } from "@/contexts/notification-context";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

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
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    async function fetchProblems() {
      setLoading(true);
      try {
        const res = await fetch(`/api/v1/problems?task_id=${taskId}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setProblems(data ?? []);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchProblems();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  const handleEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const newProblem = event.new as unknown as Problem;
        if (newProblem.taskId === taskId) {
          setProblems((prev) => [newProblem, ...prev]);
        }
      } else if (event.event === "UPDATE") {
        const updated = event.new as unknown as Problem;
        setProblems((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      } else if (event.event === "DELETE") {
        const deleted = event.old as unknown as { id: string };
        setProblems((prev) => prev.filter((p) => p.id !== deleted.id));
      }
    },
    [taskId]
  );

  useRealtimeEvents({
    table: "problems",
    onEvent: handleEvent,
  });

  const updateStatus = async (problemId: string, status: string) => {
    setActionLoading(problemId);
    try {
      const res = await fetch(`/api/v1/problems`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          problemId,
          status,
          resolvedBy: status === "resolved" || status === "dismissed" ? userId : undefined,
          workspaceId,
          taskId,
        }),
      });
      if (!res.ok) throw new Error("Failed to update");
      router.refresh();
    } catch {
      addToast({
        type: "warning",
        title: "Failed to update problem",
        description: "Please try again",
      });
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="p-4 font-[family-name:var(--font-pixel)]">
      {loading && <p className="text-sm text-mac-gray text-center py-4">Loading problems...</p>}
      {!loading && problems.length === 0 && (
        <p className="text-sm text-mac-gray text-center py-4">No problems linked to this task</p>
      )}
      <ul className="space-y-3">
        {problems.map((problem) => (
          <li key={problem.id} className="border border-mac-border rounded-md bg-mac-white p-3">
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
                {problem.agents?.name ?? "Unknown agent"} -- {relativeTime(problem.createdAt)}
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
