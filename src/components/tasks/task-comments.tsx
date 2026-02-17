"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";
import { CommentForm } from "./comment-form";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Comment = Tables<"task_comments"> & { agents?: { name: string } | null };

interface TaskCommentsProps {
  taskId: string;
}

export function TaskComments({ taskId }: TaskCommentsProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const { userId } = useWorkspace();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function fetchComments() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("task_comments")
        .select("*, agents(name)")
        .eq("task_id", taskId)
        .order("created_at", { ascending: true });
      if (!cancelled) {
        setComments((data as Comment[]) ?? []);
        setLoading(false);
      }
    }
    fetchComments();
    return () => {
      cancelled = true;
    };
  }, [taskId]);

  // Scroll to bottom when comments change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [comments.length]);

  const handlePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newComment = payload.new as unknown as Comment;
        if (newComment.task_id === taskId) {
          setComments((prev) => [...prev, newComment]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as Comment;
        setComments((prev) =>
          prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c))
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as { id: string };
        setComments((prev) => prev.filter((c) => c.id !== deleted.id));
      }
    },
    [taskId]
  );

  useRealtime({
    table: "task_comments",
    filter: `task_id=eq.${taskId}`,
    onPayload: handlePayload,
  });

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 font-[family-name:var(--font-pixel)]">
        {loading && (
          <p className="text-sm text-mac-gray text-center py-4">Loading comments...</p>
        )}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-mac-gray text-center py-4">No comments yet</p>
        )}
        {comments.map((comment) => {
          const isAgent = !!comment.agent_id;
          const isCurrentUser = comment.user_id === userId;
          return (
            <div
              key={comment.id}
              className={`border-l-2 pl-3 py-1 ${
                isAgent ? "border-l-mac-dark-gray" : "border-l-mac-highlight"
              }`}
            >
              <div className="flex items-center gap-1 text-xs text-mac-dark-gray">
                <span>{isAgent ? "\u25C6" : "\u25CB"}</span>
                <span className="font-bold">
                  {isAgent ? comment.agents?.name ?? "Agent" : isCurrentUser ? "You" : "User"}
                </span>
                <span className="text-mac-gray ml-auto">
                  {relativeTime(comment.created_at)}
                </span>
              </div>
              <p className="text-sm text-mac-black mt-0.5 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          );
        })}
      </div>
      <div className="shrink-0 border-t border-mac-border p-3">
        <CommentForm taskId={taskId} />
      </div>
    </div>
  );
}
