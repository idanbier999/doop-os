"use client";

import { useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { Button } from "@/components/ui/button";

interface ProblemActionsProps {
  problemId: string;
  status: string;
  agentId: string;
  problemTitle: string;
}

export function ProblemActions({ problemId, status, agentId, problemTitle }: ProblemActionsProps) {
  const [loading, setLoading] = useState(false);
  const { userId, workspaceId } = useWorkspace();
  const supabase = useSupabase();

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    const updateData: Record<string, string> = { status: newStatus };
    if (newStatus === "resolved" || newStatus === "dismissed") {
      updateData.resolved_by = userId;
      updateData.resolved_at = new Date().toISOString();
    }
    await supabase.from("problems").update(updateData).eq("id", problemId);
    await supabase.from("activity_log").insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      user_id: userId,
      action: `problem_${newStatus}`,
      details: { problem_id: problemId, title: problemTitle },
    });
    setLoading(false);
  };

  if (status === "open") {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => updateStatus("acknowledged")}
        >
          Ack
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => updateStatus("resolved")}
        >
          Resolve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => updateStatus("dismissed")}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  if (status === "acknowledged") {
    return (
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => updateStatus("resolved")}
        >
          Resolve
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={loading}
          onClick={() => updateStatus("dismissed")}
        >
          Dismiss
        </Button>
      </div>
    );
  }

  return null;
}
