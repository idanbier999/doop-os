"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

interface MemberRow {
  id: string;
  user_id: string;
  role: string;
  created_at: string | null;
  email?: string;
}

export function TeamMembers() {
  const { workspaceId } = useWorkspace();
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadMembers() {
      const supabase = createClient();

      // Fetch workspace members
      const { data: memberData } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, created_at")
        .eq("workspace_id", workspaceId)
        .order("created_at");

      // Fetch emails via RPC
      const { data: emailData } = await supabase.rpc(
        "get_workspace_member_emails",
        { ws_id: workspaceId }
      );

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
    }

    loadMembers();
  }, [workspaceId]);

  return (
    <Card>
      <CardHeader>
        <h2 className="text-lg font-semibold text-mac-black">Team Members</h2>
      </CardHeader>
      <CardBody>
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
              </Tr>
            </Thead>
            <Tbody>
              {members.map((member) => (
                <Tr key={member.id}>
                  <Td>
                    <span className="text-mac-black">{member.email}</span>
                  </Td>
                  <Td>
                    <Badge
                      variant="status"
                      value={member.role}
                    />
                  </Td>
                  <Td>
                    {member.created_at
                      ? new Date(member.created_at).toLocaleDateString()
                      : "-"}
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        )}
      </CardBody>
    </Card>
  );
}
