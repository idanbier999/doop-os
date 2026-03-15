"use client";

import { useEffect, useState } from "react";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useWorkspace } from "@/contexts/workspace-context";
import { getPendingInvitations, revokeInvitation } from "@/app/dashboard/settings/team-actions";

interface Invitation {
  id: string;
  role: string;
  created_at: string | null;
  expires_at: string;
}

export function PendingInvitations() {
  const { workspaceId } = useWorkspace();
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await getPendingInvitations(workspaceId);
      if (!cancelled) {
        if (result.success && result.invitations) {
          setInvitations(result.invitations);
        }
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    const result = await revokeInvitation(invitationId, workspaceId);
    if (result.success) {
      setInvitations((prev) => prev.filter((inv) => inv.id !== invitationId));
    }
    setRevokingId(null);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <LoadingSpinner />
      </div>
    );
  }

  if (invitations.length === 0) {
    return <p className="text-mac-dark-gray text-sm">No pending invitations.</p>;
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)] mb-2">
        Pending Invitations
      </h3>
      <Table>
        <Thead>
          <Tr>
            <Th>Role</Th>
            <Th>Created</Th>
            <Th>Expires</Th>
            <Th>Actions</Th>
          </Tr>
        </Thead>
        <Tbody>
          {invitations.map((inv) => (
            <Tr key={inv.id}>
              <Td>
                <Badge variant="status" value={inv.role} />
              </Td>
              <Td>{inv.created_at ? new Date(inv.created_at).toLocaleDateString() : "-"}</Td>
              <Td>{new Date(inv.expires_at).toLocaleDateString()}</Td>
              <Td>
                <Button
                  variant="danger"
                  size="sm"
                  disabled={revokingId === inv.id}
                  onClick={() => handleRevoke(inv.id)}
                >
                  {revokingId === inv.id ? "Revoking..." : "Revoke"}
                </Button>
              </Td>
            </Tr>
          ))}
        </Tbody>
      </Table>
    </div>
  );
}
