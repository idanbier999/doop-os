"use client";

import { useEffect, useState } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNotifications } from "@/contexts/notification-context";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { ReassignOwnerModal } from "@/components/agents/reassign-owner-modal";
import { testWebhook } from "@/app/dashboard/settings/actions";
import {
  getAgents,
  getWorkspaceMembers,
  updateAgent,
  generateWebhookSecret,
  deleteAgent,
} from "@/app/dashboard/agents/actions";
import type { MemberInfo } from "@/lib/workspace-members";
import { Fragment } from "react";

/** Local agent type matching the Drizzle camelCase return shape from getAgents() */
interface Agent {
  id: string;
  name: string;
  agentType: string | null;
  health: string;
  stage: string;
  platform: string | null;
  description: string | null;
  tags: string[] | null;
  capabilities: string[] | null;
  webhookUrl: string | null;
  webhookSecret: string | null;
  apiKeyPrefix: string;
  ownerId: string | null;
  lastSeenAt: Date | string | null;
  metadata: unknown;
  createdAt: Date | string | null;
  updatedAt: Date | string | null;
  workspaceId: string;
}

export function AgentsSettings() {
  const { workspaceId, userId, userRole } = useWorkspace();
  const { addToast } = useNotifications();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Agent | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [editingTags, setEditingTags] = useState<string | null>(null);
  const [tagInput, setTagInput] = useState("");
  const [editingWebhook, setEditingWebhook] = useState<string | null>(null);
  const [webhookInput, setWebhookInput] = useState("");
  const [editingCapabilities, setEditingCapabilities] = useState<string | null>(null);
  const [capabilitiesInput, setCapabilitiesInput] = useState("");
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());
  const [expandedWebhook, setExpandedWebhook] = useState<Set<string>>(new Set());
  const [testingWebhook, setTestingWebhook] = useState<Set<string>>(new Set());
  const [memberMap, setMemberMap] = useState<Map<string, MemberInfo>>(new Map());
  const [reassignTarget, setReassignTarget] = useState<Agent | null>(null);

  const isAdminOrOwner = userRole === "owner" || userRole === "admin";

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [agentsResult, membersResult] = await Promise.all([
        getAgents(workspaceId),
        getWorkspaceMembers(workspaceId),
      ]);
      if (!cancelled) {
        setAgents((agentsResult.agents as Agent[]) || []);
        const map = new Map<string, MemberInfo>();
        for (const m of membersResult.members) {
          map.set(m.userId, m);
        }
        setMemberMap(map);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId]);

  function canEditAgent(agent: Agent): boolean {
    if (isAdminOrOwner) return true;
    return agent.ownerId === userId;
  }

  function toggleSecretReveal(agentId: string) {
    setRevealedSecrets((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  function toggleWebhookExpand(agentId: string) {
    setExpandedWebhook((prev) => {
      const next = new Set(prev);
      if (next.has(agentId)) {
        next.delete(agentId);
      } else {
        next.add(agentId);
      }
      return next;
    });
  }

  function maskSecret(secret: string | null) {
    if (!secret) return null;
    return "••••••••" + secret.slice(-4);
  }

  function truncateUrl(url: string | null) {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      const display = parsed.hostname + parsed.pathname;
      return display.length > 32 ? display.slice(0, 32) + "..." : display;
    } catch {
      return url.length > 32 ? url.slice(0, 32) + "..." : url;
    }
  }

  function ownerName(ownerId: string | null): string {
    if (!ownerId) return "Unassigned";
    const member = memberMap.get(ownerId);
    return member?.name ?? "Unknown";
  }

  async function handleSaveTags(agentId: string) {
    const tagsArray = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const result = await updateAgent({ agentId, workspaceId, tags: tagsArray });
    if (result.success) {
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, tags: tagsArray } : a)));
    }
    setEditingTags(null);
    setTagInput("");
  }

  async function handleSaveWebhookUrl(agentId: string) {
    const url = webhookInput.trim();
    const result = await updateAgent({ agentId, workspaceId, webhookUrl: url || null });
    if (result.success) {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, webhookUrl: url || null } : a))
      );
    }
    setEditingWebhook(null);
    setWebhookInput("");
  }

  async function handleGenerateSecret(agentId: string) {
    const result = await generateWebhookSecret(agentId, workspaceId);
    if (result.success && result.secret) {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, webhookSecret: result.secret! } : a))
      );
      addToast({
        type: "info",
        title: "Webhook secret generated",
        description: "New secret saved for agent",
      });
    }
  }

  async function handleCopySecret(secret: string) {
    await navigator.clipboard.writeText(secret);
    addToast({ type: "info", title: "Copied to clipboard" });
  }

  async function handleTestWebhook(agentId: string) {
    setTestingWebhook((prev) => new Set(prev).add(agentId));
    const result = await testWebhook(agentId, workspaceId);
    setTestingWebhook((prev) => {
      const next = new Set(prev);
      next.delete(agentId);
      return next;
    });
    if (result.success) {
      addToast({
        type: "info",
        title: "Webhook test succeeded",
        description: "The endpoint responded successfully",
      });
    } else {
      addToast({ type: "warning", title: "Webhook test failed", description: result.error });
    }
  }

  async function handleSaveCapabilities(agentId: string) {
    const caps = capabilitiesInput
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);
    const result = await updateAgent({ agentId, workspaceId, capabilities: caps });
    if (result.success) {
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, capabilities: caps } : a)));
    }
    setEditingCapabilities(null);
    setCapabilitiesInput("");
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    await deleteAgent(deleteTarget.id, workspaceId);

    setAgents((prev) => prev.filter((a) => a.id !== deleteTarget.id));
    setDeleteTarget(null);
    setDeleting(false);
  }

  return (
    <>
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-mac-black">Registered Agents</h2>
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
                  <Th>Owner</Th>
                  <Th>Tags</Th>
                  <Th>API Key</Th>
                  <Th>Webhook</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {agents.map((agent) => {
                  const editable = canEditAgent(agent);
                  return (
                    <Fragment key={agent.id}>
                      <Tr>
                        <Td>
                          <span className="text-mac-black font-medium">{agent.name}</span>
                        </Td>
                        <Td>{agent.agentType || "-"}</Td>
                        <Td>
                          <Badge variant="health" value={agent.health} />
                        </Td>
                        <Td>
                          <span className="text-xs text-mac-gray">{ownerName(agent.ownerId)}</span>
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
                                onClick={() => {
                                  setEditingTags(null);
                                  setTagInput("");
                                }}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <span className="text-xs text-mac-gray">
                                {agent.tags && agent.tags.length > 0 ? agent.tags.join(", ") : "-"}
                              </span>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!editable}
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
                          <code className="text-xs text-mac-gray font-mono">
                            {agent.apiKeyPrefix ? `${agent.apiKeyPrefix}...` : "No key"}
                          </code>
                        </Td>
                        <Td>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleWebhookExpand(agent.id)}
                          >
                            {agent.webhookUrl ? truncateUrl(agent.webhookUrl) : "Configure"}{" "}
                            {expandedWebhook.has(agent.id) ? "▲" : "▼"}
                          </Button>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            {isAdminOrOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setReassignTarget(agent)}
                              >
                                Reassign
                              </Button>
                            )}
                            {editable && (
                              <Button
                                variant="danger"
                                size="sm"
                                onClick={() => setDeleteTarget(agent)}
                              >
                                Delete
                              </Button>
                            )}
                          </div>
                        </Td>
                      </Tr>
                      {expandedWebhook.has(agent.id) && (
                        <Tr>
                          <Td colSpan={8}>
                            <div className="bg-mac-light-gray border border-mac-border rounded-[2px] p-4 space-y-4">
                              {/* Webhook URL */}
                              <div>
                                <p className="text-xs font-semibold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
                                  Webhook URL
                                </p>
                                {editingWebhook === agent.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="url"
                                      value={webhookInput}
                                      onChange={(e) => setWebhookInput(e.target.value)}
                                      placeholder="https://example.com/webhook"
                                      className="rounded-[2px] border border-mac-black bg-mac-white px-2 py-1 text-xs text-mac-black shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black font-[family-name:var(--font-pixel)] w-72"
                                    />
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleSaveWebhookUrl(agent.id)}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingWebhook(null);
                                        setWebhookInput("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <code className="text-xs text-mac-gray font-mono">
                                      {agent.webhookUrl || "Not configured"}
                                    </code>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingWebhook(agent.id);
                                        setWebhookInput(agent.webhookUrl || "");
                                      }}
                                    >
                                      Edit
                                    </Button>
                                    {agent.webhookUrl && (
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleTestWebhook(agent.id)}
                                        disabled={testingWebhook.has(agent.id)}
                                      >
                                        {testingWebhook.has(agent.id) ? "Testing..." : "Test"}
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Webhook Secret */}
                              <div>
                                <p className="text-xs font-semibold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
                                  Webhook Secret
                                </p>
                                <div className="flex items-center gap-2">
                                  <code className="text-xs text-mac-gray font-mono">
                                    {agent.webhookSecret
                                      ? revealedSecrets.has(agent.id)
                                        ? agent.webhookSecret
                                        : maskSecret(agent.webhookSecret)
                                      : "Not set"}
                                  </code>
                                  {agent.webhookSecret && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleSecretReveal(agent.id)}
                                      >
                                        {revealedSecrets.has(agent.id) ? "Hide" : "Show"}
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => handleCopySecret(agent.webhookSecret!)}
                                      >
                                        Copy
                                      </Button>
                                    </>
                                  )}
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => handleGenerateSecret(agent.id)}
                                  >
                                    Generate
                                  </Button>
                                </div>
                              </div>

                              {/* Capabilities */}
                              <div>
                                <p className="text-xs font-semibold text-mac-black mb-1 font-[family-name:var(--font-pixel)]">
                                  Capabilities
                                </p>
                                {editingCapabilities === agent.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="text"
                                      value={capabilitiesInput}
                                      onChange={(e) => setCapabilitiesInput(e.target.value)}
                                      placeholder="cap1, cap2, ..."
                                      className="rounded-[2px] border border-mac-black bg-mac-white px-2 py-1 text-xs text-mac-black shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black font-[family-name:var(--font-pixel)] w-64"
                                    />
                                    <Button
                                      variant="primary"
                                      size="sm"
                                      onClick={() => handleSaveCapabilities(agent.id)}
                                    >
                                      Save
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingCapabilities(null);
                                        setCapabilitiesInput("");
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-mac-gray">
                                      {agent.capabilities && agent.capabilities.length > 0
                                        ? agent.capabilities.join(", ")
                                        : "-"}
                                    </span>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => {
                                        setEditingCapabilities(agent.id);
                                        setCapabilitiesInput(agent.capabilities?.join(", ") || "");
                                      }}
                                    >
                                      Edit
                                    </Button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </Td>
                        </Tr>
                      )}
                    </Fragment>
                  );
                })}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      <Modal open={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Agent">
        <div className="space-y-4">
          <p className="text-mac-dark-gray">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-mac-black">{deleteTarget?.name}</span>? This action
            cannot be undone. All associated data will remain but the agent will no longer be able
            to connect.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Deleting..." : "Delete Agent"}
            </Button>
          </div>
        </div>
      </Modal>

      {reassignTarget && (
        <ReassignOwnerModal
          open={!!reassignTarget}
          onClose={() => setReassignTarget(null)}
          agentId={reassignTarget.id}
          agentName={reassignTarget.name}
          currentOwnerId={reassignTarget.ownerId}
          workspaceId={workspaceId}
        />
      )}
    </>
  );
}
