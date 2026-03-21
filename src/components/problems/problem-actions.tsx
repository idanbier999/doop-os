"use client";

import { useState } from "react";
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

  const updateStatus = async (newStatus: string) => {
    setLoading(true);
    try {
      await fetch(`/api/internal/problems/${problemId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          userId,
          workspaceId,
          agentId,
          problemTitle,
        }),
      });
    } catch {
      // silently fail
    }
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
