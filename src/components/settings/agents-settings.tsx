"use client";

import { useEffect, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNotifications } from "@/contexts/notification-context";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { testWebhook } from "@/app/dashboard/settings/actions";
import { Fragment } from "react";
import type { Tables } from "@/lib/database.types";

type Agent = Tables<"agents">;

export function AgentsSettings() {
  const { workspaceId } = useWorkspace();
  const supabase = useSupabase();
  const { addToast } = useNotifications();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedKeys, setRevealedKeys] = useState<Set<string>>(new Set());
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("agents")
        .select("*")
        .eq("workspace_id", workspaceId)
        .order("name");
      if (!cancelled) {
        setAgents(data || []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspaceId, supabase]);

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

  function maskKey(key: string | null) {
    if (!key) return "No key";
    return key.slice(0, 8) + "..." + key.slice(-4);
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

  async function handleSaveTags(agentId: string) {
    const tagsArray = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    const { error } = await supabase.from("agents").update({ tags: tagsArray }).eq("id", agentId);
    if (!error) {
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, tags: tagsArray } : a)));
    }
    setEditingTags(null);
    setTagInput("");
  }

  async function handleSaveWebhookUrl(agentId: string) {
    const url = webhookInput.trim();
    const { error } = await supabase
      .from("agents")
      .update({ webhook_url: url || null })
      .eq("id", agentId);
    if (!error) {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, webhook_url: url || null } : a))
      );
    }
    setEditingWebhook(null);
    setWebhookInput("");
  }

  async function handleGenerateSecret(agentId: string) {
    const newSecret = crypto.randomUUID().replace(/-/g, "");
    const { error } = await supabase
      .from("agents")
      .update({ webhook_secret: newSecret })
      .eq("id", agentId);
    if (!error) {
      setAgents((prev) =>
        prev.map((a) => (a.id === agentId ? { ...a, webhook_secret: newSecret } : a))
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
    const { error } = await supabase
      .from("agents")
      .update({ capabilities: caps })
      .eq("id", agentId);
    if (!error) {
      setAgents((prev) => prev.map((a) => (a.id === agentId ? { ...a, capabilities: caps } : a)));
    }
    setEditingCapabilities(null);
    setCapabilitiesInput("");
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
                  <Th>Tags</Th>
                  <Th>API Key</Th>
                  <Th>Webhook</Th>
                  <Th>Actions</Th>
                </Tr>
              </Thead>
              <Tbody>
                {agents.map((agent) => (
                  <Fragment key={agent.id}>
                    <Tr>
                      <Td>
                        <span className="text-mac-black font-medium">{agent.name}</span>
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
                            {revealedKeys.has(agent.id) ? agent.api_key : maskKey(agent.api_key)}
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
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleWebhookExpand(agent.id)}
                        >
                          {agent.webhook_url ? truncateUrl(agent.webhook_url) : "Configure"}{" "}
                          {expandedWebhook.has(agent.id) ? "▲" : "▼"}
                        </Button>
                      </Td>
                      <Td>
                        <Button variant="danger" size="sm" onClick={() => setDeleteTarget(agent)}>
                          Delete
                        </Button>
                      </Td>
                    </Tr>
                    {expandedWebhook.has(agent.id) && (
                      <Tr>
                        <Td colSpan={7}>
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
                                    {agent.webhook_url || "Not configured"}
                                  </code>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setEditingWebhook(agent.id);
                                      setWebhookInput(agent.webhook_url || "");
                                    }}
                                  >
                                    Edit
                                  </Button>
                                  {agent.webhook_url && (
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
                                  {agent.webhook_secret
                                    ? revealedSecrets.has(agent.id)
                                      ? agent.webhook_secret
                                      : maskSecret(agent.webhook_secret)
                                    : "Not set"}
                                </code>
                                {agent.webhook_secret && (
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
                                      onClick={() => handleCopySecret(agent.webhook_secret!)}
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
                ))}
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
    </>
  );
}
