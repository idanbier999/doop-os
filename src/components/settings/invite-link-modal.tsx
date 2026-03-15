"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useWorkspace } from "@/contexts/workspace-context";
import { createInviteLink } from "@/app/dashboard/settings/team-actions";

interface InviteLinkModalProps {
  open: boolean;
  onClose: () => void;
}

export function InviteLinkModal({ open, onClose }: InviteLinkModalProps) {
  const { workspaceId, userRole } = useWorkspace();
  const [role, setRole] = useState<"admin" | "member">("member");
  const [inviteUrl, setInviteUrl] = useState("");
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleClose = () => {
    setRole("member");
    setInviteUrl("");
    setError("");
    setGenerating(false);
    setCopied(false);
    onClose();
  };

  const handleGenerate = async () => {
    setGenerating(true);
    setError("");
    setInviteUrl("");

    const result = await createInviteLink(workspaceId, role);

    if (result.success && result.token) {
      setInviteUrl(`${window.location.origin}/invite/${result.token}`);
    } else {
      setError(result.error || "Failed to generate invite link");
    }

    setGenerating(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={open} onClose={handleClose} title="Invite Member">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)] mb-1">
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as "admin" | "member")}
            disabled={generating}
            className="block w-full rounded-md border border-mac-border bg-mac-white px-2 py-1 text-sm text-mac-black mac-inset focus:outline-none focus:ring-2 focus:ring-mac-highlight/50"
          >
            <option value="member">Member</option>
            {userRole === "owner" && <option value="admin">Admin</option>}
          </select>
        </div>

        <Button size="sm" onClick={handleGenerate} disabled={generating}>
          {generating ? "Generating..." : "Generate Link"}
        </Button>

        {error && (
          <p className="text-sm text-severity-critical font-[family-name:var(--font-pixel)]">
            {error}
          </p>
        )}

        {inviteUrl && (
          <div className="flex gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 rounded-md border border-mac-border bg-mac-light-gray px-2 py-1 text-sm text-mac-black mac-inset focus:outline-none"
            />
            <Button variant="ghost" size="sm" onClick={handleCopy}>
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}
