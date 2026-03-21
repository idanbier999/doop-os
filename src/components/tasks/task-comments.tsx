"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { CommentForm } from "./comment-form";
import { relativeTime } from "@/lib/utils";
import type { Tables } from "@/lib/database.types";

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
      try {
        const res = await fetch(`/api/v1/tasks/${taskId}/comments`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            setComments(data ?? []);
          }
        }
      } finally {
        if (!cancelled) setLoading(false);
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

  const handleEvent = useCallback(
    (event: { event: string; new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      if (event.event === "INSERT") {
        const newComment = event.new as unknown as Comment;
        if (newComment.taskId === taskId) {
          setComments((prev) => [...prev, newComment]);
        }
      } else if (event.event === "UPDATE") {
        const updated = event.new as unknown as Comment;
        setComments((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
      } else if (event.event === "DELETE") {
        const deleted = event.old as unknown as { id: string };
        setComments((prev) => prev.filter((c) => c.id !== deleted.id));
      }
    },
    [taskId]
  );

  useRealtimeEvents({
    table: "task_comments",
    onEvent: handleEvent,
  });

  return (
    <div className="flex flex-col h-full">
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-3 font-[family-name:var(--font-pixel)]"
      >
        {loading && <p className="text-sm text-mac-gray text-center py-4">Loading comments...</p>}
        {!loading && comments.length === 0 && (
          <p className="text-sm text-mac-gray text-center py-4">No comments yet</p>
        )}
        {comments.map((comment) => {
          const isAgent = !!comment.agentId;
          const isCurrentUser = comment.userId === userId;
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
                  {isAgent ? (comment.agents?.name ?? "Agent") : isCurrentUser ? "You" : "User"}
                </span>
                <span className="text-mac-gray ml-auto">{relativeTime(comment.createdAt)}</span>
              </div>
              <p className="text-sm text-mac-black mt-0.5 whitespace-pre-wrap">{comment.content}</p>
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
