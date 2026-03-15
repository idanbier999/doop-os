"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ReassignOwnerModal } from "@/components/agents/reassign-owner-modal";

interface AgentDetailActionsProps {
  agentId: string;
  agentName: string;
  currentOwnerId: string | null;
  workspaceId: string;
  userRole: string;
}

export function AgentDetailActions({
  agentId,
  agentName,
  currentOwnerId,
  workspaceId,
  userRole,
}: AgentDetailActionsProps) {
  const [reassignOpen, setReassignOpen] = useState(false);

  const canReassign = userRole === "owner" || userRole === "admin";

  if (!canReassign) return null;

  return (
    <>
      <Button variant="secondary" size="sm" onClick={() => setReassignOpen(true)}>
        Reassign
      </Button>
      <ReassignOwnerModal
        open={reassignOpen}
        onClose={() => setReassignOpen(false)}
        agentId={agentId}
        agentName={agentName}
        currentOwnerId={currentOwnerId}
        workspaceId={workspaceId}
      />
    </>
  );
}
