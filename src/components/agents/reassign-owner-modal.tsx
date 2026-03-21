"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { reassignAgentOwner, getWorkspaceMembers } from "@/app/dashboard/agents/actions";
import type { MemberInfo } from "@/lib/workspace-members";

interface ReassignOwnerModalProps {
  open: boolean;
  onClose: () => void;
  agentId: string;
  agentName: string;
  currentOwnerId: string | null;
  workspaceId: string;
}

export function ReassignOwnerModal({
  open,
  onClose,
  agentId,
  agentName,
  currentOwnerId,
  workspaceId,
}: ReassignOwnerModalProps) {
  const router = useRouter();
  const [members, setMembers] = useState<MemberInfo[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- resetting form state on modal open is intentional
    setError(null);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSubmitting(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedId(currentOwnerId ?? "");

    getWorkspaceMembers(workspaceId).then((result) => {
      if (result.success) {
        setMembers(result.members);
      }
    });
  }, [open, workspaceId, currentOwnerId]);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    const newOwnerId = selectedId === "" ? null : selectedId;
    const result = await reassignAgentOwner(workspaceId, agentId, newOwnerId);
    if (result.success) {
      router.refresh();
      onClose();
    } else {
      setError(result.error ?? "Failed to reassign");
    }
    setSubmitting(false);
  }

  return (
    <Modal open={open} onClose={onClose} title={`Reassign ${agentName}`}>
      <div className="space-y-4">
        <div>
          <label
            htmlFor="owner-select"
            className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
          >
            New Owner
          </label>
          <select
            id="owner-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
          >
            <option value="">Unassigned</option>
            {members.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.name}
                {m.userId === currentOwnerId ? " (current)" : ""}
              </option>
            ))}
          </select>
        </div>

        {error && <p className="text-sm text-severity-critical">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || selectedId === (currentOwnerId ?? "")}
          >
            {submitting ? "Reassigning..." : "Reassign"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
