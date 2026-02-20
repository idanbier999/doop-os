"use client";

import { useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";

interface CommentFormProps {
  taskId: string;
}

export function CommentForm({ taskId }: CommentFormProps) {
  const supabase = useSupabase();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { workspaceId, userId } = useWorkspace();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = content.trim();
    if (!trimmed || submitting) return;

    setSubmitting(true);
    try {
      await supabase.from("task_comments").insert({
        task_id: taskId,
        workspace_id: workspaceId,
        user_id: userId,
        content: trimmed,
      });

      await supabase.from("activity_log").insert({
        workspace_id: workspaceId,
        user_id: userId,
        action: "task_comment",
        details: { task_id: taskId },
      });

      setError("");
      setContent("");
    } catch {
      setError("Failed to send comment. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 font-[family-name:var(--font-pixel)]">
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Add a comment..."
        rows={3}
        className="mac-inset w-full resize-none rounded-md px-2 py-1.5 text-sm text-mac-black placeholder:text-mac-gray focus:outline-none focus:ring-2 focus:ring-mac-highlight/50 font-[family-name:var(--font-pixel)]"
      />
      {error && <p className="text-xs text-severity-critical font-[family-name:var(--font-pixel)]">{error}</p>}
      <div className="flex justify-end">
        <Button
          type="submit"
          size="sm"
          disabled={!content.trim() || submitting}
        >
          {submitting ? "Sending..." : "Send"}
        </Button>
      </div>
    </form>
  );
}
