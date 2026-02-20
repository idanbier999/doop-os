"use client";

import { useEffect, useState, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
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
  const supabase = useSupabase();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");

  const loadAgents = useCallback(async () => {
    const { data } = await supabase
      .from("agents")
      .select("*")
      .eq("workspace_id", workspaceId)
      .order("name");

    setAgents(data || []);
    setLoading(false);
  }, [workspaceId, supabase]);

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

  async function handleSaveTags(agentId: string) {
    const tagsArray = tagInput.split(",").map(t => t.trim()).filter(Boolean);
    const { error } = await supabase.from("agents").update({ tags: tagsArray }).eq("id", agentId);
    if (!error) {
      setAgents(prev => prev.map(a => a.id === agentId ? { ...a, tags: tagsArray } : a));
    }
    setEditingTags(null);
    setTagInput("");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    await supabase.from("agents").delete().eq("id", deleteTarget.id);

    setAgents((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-mac-black">
            Registered Agents
          </h2>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : agents.length === 0 ? (
            <p className="text-mac-dark-gray text-sm">
              No agents registered yet. Agents connect via MCP.
            </p>
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Type</Th>
                  <Th>Health</Th>
                  <Th>Tags</Th>
                  <Th>API Key</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {agents.map((agent) => (
                  <Tr key={agent.id}>
                    <Td>
                      <span className="text-mac-black font-medium">
                        {agent.name}
                      </span>
                    </Td>
                    <Td>{agent.agent_type || "-"}</Td>
                    <Td>
                      <Badge variant="health" value={agent.health} />
                    </Td>
                    <Td>
                      {editingTags === agent.id ? (
                        <div className="flex items-center gap-1">
                          <input
                            type="text"
                            value={tagInput}
                            onChange={(e) => setTagInput(e.target.value)}
                            placeholder="tag1, tag2, ..."
                            className="rounded-[2px] border border-mac-black bg-mac-white px-2 py-1 text-xs text-mac-black shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black font-[family-name:var(--font-pixel)] w-36"
                          />
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleSaveTags(agent.id)}
                          >
                            Save
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => { setEditingTags(null); setTagInput(""); }}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-mac-gray">
                            {agent.tags && agent.tags.length > 0
                              ? agent.tags.join(", ")
                              : "-"}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingTags(agent.id);
                              setTagInput(agent.tags?.join(", ") || "");
                            }}
                          >
                            Edit
                          </Button>
                        </div>
                      )}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-mac-gray font-mono">
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
          <p className="text-mac-dark-gray">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-mac-black">
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
