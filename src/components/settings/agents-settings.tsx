"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/workspace-context";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import type { Tables } from "@/lib/database.types";

type Agent = Tables<"agents">;

export function AgentsSettings() {
  const { workspaceId } = useWorkspace();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadAgents = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name");

    setAgents(data || []);
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    loadAgents();
  }, [loadAgents]);

  function toggleKeyReveal(agentId: string) {
    setRevealedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  function maskKey(key: string | null) {
    if (!key) return "No key";
    return key.slice(0, 8) + "..." + key.slice(-4);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const supabase = createClient();
    await supabase.from("agents").delete().eq("id", deleteTarget.id);

    setAgents((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-100">
            Registered Agents
          </h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-gray-500 text-sm">
              No agents registered yet. Agents connect via MCP.
            </p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Health</Th>
                  <Th>API Key</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {agents.map((agent) => (
                  <Tr key={agent.id}>
                    <Td>
                      <span className="text-gray-100 font-medium">
                        {agent.name}
                      </span>
                    </Td>
                    <Td>{agent.agent_type || "-"}</Td>
                    <Td>
                      <Badge variant="health" value={agent.health} />
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-gray-400 font-mono">
                          {revealedKeys.has(agent.id)
                            ? agent.api_key
                            : maskKey(agent.api_key)}
                        </code>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleKeyReveal(agent.id)}
                        >
                          {revealedKeys.has(agent.id) ? "Hide" : "Show"}
                        </Button>
                      </div>
                    </Td>
                    <Td>
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={() => setDeleteTarget(agent)}
                      >
                        Delete
                      </Button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Agent"
      >
        <div className="space-y-4">
          <p className="text-gray-300">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-gray-100">
              {deleteTarget?.name}
            </span>
            ? This action cannot be undone. All associated data will remain but
            the agent will no longer be able to connect.
          </p>
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete Agent"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
