"use client";

import { useCallback, useEffect, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { updateMemberRole, removeMember } from "@/app/dashboard/settings/team-actions";
import { InviteLinkModal } from "@/components/settings/invite-link-modal";
import { PendingInvitations } from "@/components/settings/pending-invitations";

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string | null;
  email?: string;
}

export function TeamMembers() {
  const { workspaceId, userId, userRole } = useWorkspace();
  const supabase = useSupabase();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<MemberRow | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const isOwnerOrAdmin = userRole === "owner" || userRole === "admin";
  const isOwner = userRole === "owner";

  const loadMembers = useCallback(async () => {
    const { data: memberData } = await supabase
      .from("workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at");

    const { data: emailData } = await supabase.rpc("get_workspace_member_emails", {
      ws_id: workspaceId,
    });

    const emailMap = new Map<string, string>();
    if (emailData) {
      for (const row of emailData) {
        emailMap.set(row.user_id, row.email);
      }
    }

    const enriched: MemberRow[] = (memberData || []).map((m) => ({
      ...m,
      email: emailMap.get(m.user_id) || "Unknown",
    }));

    setMembers(enriched);
    setLoading(false);
  }, [workspaceId, supabase]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at");

      const { data: emailData } = await supabase.rpc("get_workspace_member_emails", {
        ws_id: workspaceId,
      });

      if (cancelled) return;

      const emailMap = new Map<string, string>();
      if (emailData) {
        for (const row of emailData) {
          emailMap.set(row.user_id, row.email);
        }
      }

      const enriched: MemberRow[] = (memberData || []).map((m) => ({
        ...m,
        email: emailMap.get(m.user_id) || "Unknown",
      }));

      setMembers(enriched);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, supabase]);

  const handleRoleChange = async (memberId: string, newRole: string) => {
    if (newRole !== "admin" && newRole !== "member") return;
    setActionLoading(memberId);
    setActionError(null);
    const result = await updateMemberRole(workspaceId, memberId, newRole);
    if (result.success) {
      await loadMembers();
    } else {
      setActionError(result.error || "Failed to update role");
    }
    setActionLoading(null);
  };

  const handleRemove = async () => {
    if (!removeTarget) return;
    setActionLoading(removeTarget.id);
    setActionError(null);
    const result = await removeMember(workspaceId, removeTarget.id);
    if (result.success) {
      setRemoveTarget(null);
      await loadMembers();
    } else {
      setActionError(result.error || "Failed to remove member");
    }
    setActionLoading(null);
  };

  const canChangeRole = (member: MemberRow) => {
    if (!isOwner) return false;
    if (member.user_id === userId) return false;
    if (member.role === "owner") return false;
    return true;
  };

  const canRemove = (member: MemberRow) => {
    if (member.user_id === userId) return false;
    if (member.role === "owner") return false;
    if (isOwner) return true;
    if (userRole === "admin" && member.role === "member") return true;
    return false;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-mac-black">Team Members</h2>
            {isOwnerOrAdmin && (
              <Button size="sm" onClick={() => setInviteModalOpen(true)}>
                Invite Member
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {actionError && (
            <div className="mb-4 rounded-md border border-severity-critical bg-mac-white px-3 py-2 text-sm text-severity-critical font-[family-name:var(--font-pixel)]">
              {actionError}
            </div>
          )}
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : members.length === 0 ? (
            <p className="text-mac-dark-gray text-sm">No members found.</p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Email</Th>
                  <Th>Role</Th>
                  <Th>Joined</Th>
                  {isOwnerOrAdmin && <Th>Actions</Th>}
                </Tr>
              </Thead>
              <Tbody>
                {members.map((member) => (
                  <Tr key={member.id}>
                    <Td>
                      <span className="text-mac-black">
                        {member.email}
                        {member.user_id === userId && (
                          <span className="text-mac-dark-gray ml-1">(you)</span>
                        )}
                      </span>
                    </Td>
                    <Td>
                      {canChangeRole(member) ? (
                        <select
                          value={member.role}
                          onChange={(e) => handleRoleChange(member.id, e.target.value)}
                          disabled={actionLoading === member.id}
                          className="block rounded-md border border-mac-border bg-mac-white px-2 py-1 text-sm text-mac-black mac-inset focus:outline-none focus:ring-2 focus:ring-mac-highlight/50"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Member</option>
                        </select>
                      ) : (
                        <Badge variant="status" value={member.role} />
                      )}
                    </Td>
                    <Td>
                      {member.created_at ? new Date(member.created_at).toLocaleDateString() : "-"}
                    </Td>
                    {isOwnerOrAdmin && (
                      <Td>
                        {canRemove(member) && (
                          <Button
                            variant="danger"
                            size="sm"
                            disabled={actionLoading === member.id}
                            onClick={() => setRemoveTarget(member)}
                          >
                            Remove
                          </Button>
                        )}
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}

          {isOwnerOrAdmin && (
            <div className="mt-6">
              <PendingInvitations />
            </div>
          )}
        </CardBody>
      </Card>

      <InviteLinkModal open={inviteModalOpen} onClose={() => setInviteModalOpen(false)} />

      <Modal open={!!removeTarget} onClose={() => setRemoveTarget(null)} title="Remove Member">
        <p className="text-sm text-mac-black mb-4 font-[family-name:var(--font-pixel)]">
          Are you sure you want to remove <strong>{removeTarget?.email}</strong> from this
          workspace? They will lose access immediately.
        </p>
        <div className="flex gap-3 justify-end">
          <Button variant="secondary" size="sm" onClick={() => setRemoveTarget(null)}>
            Cancel
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleRemove}
            disabled={actionLoading === removeTarget?.id}
          >
            {actionLoading === removeTarget?.id ? "Removing..." : "Remove"}
          </Button>
        </div>
      </Modal>
    </>
  );
}
