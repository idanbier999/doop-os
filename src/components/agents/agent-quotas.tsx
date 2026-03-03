"use client";

import { useEffect, useState, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNotifications } from "@/contexts/notification-context";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Table, Thead, Tbody, Tr, Th, Td } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { EmptyState } from "@/components/ui/empty-state";
import {
  getQuotas,
  upsertQuota,
  deleteQuota,
} from "@/app/dashboard/agents/quota-actions";

interface Quota {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  max_requests_per_minute: number;
  max_requests_per_hour: number;
  updated_at: string;
}

interface AgentQuotasProps {
  agents: Array<{ id: string; name: string }>;
  workspaceId: string;
}

export function AgentQuotas({ agents, workspaceId }: AgentQuotasProps) {
  const { userRole } = useWorkspace();
  const { addToast } = useNotifications();
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [loading, setLoading] = useState(true);
  const [editModal, setEditModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Quota | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formAgentId, setFormAgentId] = useState("");
  const [formMaxPerMinute, setFormMaxPerMinute] = useState("");
  const [formMaxPerHour, setFormMaxPerHour] = useState("");
  const [editingQuota, setEditingQuota] = useState<Quota | null>(null);

  const canEdit = userRole === "owner" || userRole === "admin";

  const loadQuotas = useCallback(async () => {
    const result = await getQuotas(workspaceId);
    if (result.success && "quotas" in result) {
      setQuotas(result.quotas ?? []);
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    loadQuotas();
  }, [loadQuotas]);

  function getAgentName(agentId: string | null) {
    if (!agentId) return "Workspace Default";
    const agent = agents.find((a) => a.id === agentId);
    return agent?.name ?? "Unknown Agent";
  }

  function openAddModal() {
    setEditingQuota(null);
    setFormAgentId("");
    setFormMaxPerMinute("");
    setFormMaxPerHour("");
    setEditModal(true);
  }

  function openEditModal(quota: Quota) {
    setEditingQuota(quota);
    setFormAgentId(quota.agent_id ?? "");
    setFormMaxPerMinute(String(quota.max_requests_per_minute));
    setFormMaxPerHour(String(quota.max_requests_per_hour));
    setEditModal(true);
  }

  async function handleSave() {
    const maxPerMinute = parseInt(formMaxPerMinute, 10);
    const maxPerHour = parseInt(formMaxPerHour, 10);

    if (isNaN(maxPerMinute) || isNaN(maxPerHour) || maxPerMinute < 1 || maxPerHour < 1) {
      addToast({ type: "warning", title: "Invalid values", description: "Enter positive numbers for rate limits" });
      return;
    }

    setSaving(true);
    const result = await upsertQuota({
      workspaceId,
      agentId: formAgentId || undefined,
      maxPerMinute,
      maxPerHour,
    });
    setSaving(false);

    if (result.success) {
      addToast({ type: "info", title: "Quota saved" });
      setEditModal(false);
      loadQuotas();
    } else {
      addToast({ type: "warning", title: "Error", description: result.error });
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    const result = await deleteQuota(deleteTarget.id, workspaceId);
    setDeleting(false);

    if (result.success) {
      setQuotas((prev) => prev.filter((q) => q.id !== deleteTarget.id));
      addToast({ type: "info", title: "Quota deleted" });
    } else {
      addToast({ type: "warning", title: "Error", description: result.error });
    }
    setDeleteTarget(null);
  }

  const agentOptions = [
    { label: "Workspace Default", value: "" },
    ...agents.map((a) => ({ label: a.name, value: a.id })),
  ];

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-mac-black">
              Rate Limits
            </h2>
            {canEdit && (
              <Button variant="primary" size="sm" onClick={openAddModal}>
                Add Quota
              </Button>
            )}
          </div>
        </CardHeader>
        <CardBody>
          {loading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : quotas.length === 0 ? (
            <EmptyState
              message="No quotas configured"
              description="Rate limits control how many requests agents can make per minute and per hour."
            />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Scope</Th>
                  <Th>Req/Min</Th>
                  <Th>Req/Hour</Th>
                  {canEdit && <Th>Actions</Th>}
                </Tr>
              </Thead>
              <Tbody>
                {quotas.map((quota) => (
                  <Tr key={quota.id}>
                    <Td>
                      <span className="text-mac-black font-medium">
                        {getAgentName(quota.agent_id)}
                      </span>
                    </Td>
                    <Td>{quota.max_requests_per_minute}</Td>
                    <Td>{quota.max_requests_per_hour}</Td>
                    {canEdit && (
                      <Td>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditModal(quota)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="danger"
                            size="sm"
                            onClick={() => setDeleteTarget(quota)}
                          >
                            Delete
                          </Button>
                        </div>
                      </Td>
                    )}
                  </Tr>
                ))}
              </Tbody>
            </Table>
          )}
        </CardBody>
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        open={editModal}
        onClose={() => setEditModal(false)}
        title={editingQuota ? "Edit Quota" : "Add Quota"}
      >
        <div className="space-y-4">
          <Select
            label="Scope"
            options={agentOptions}
            value={formAgentId}
            onChange={(e) => setFormAgentId(e.target.value)}
            disabled={!!editingQuota}
          />
          <Input
            label="Max Requests per Minute"
            type="number"
            min={1}
            value={formMaxPerMinute}
            onChange={(e) => setFormMaxPerMinute(e.target.value)}
            placeholder="60"
          />
          <Input
            label="Max Requests per Hour"
            type="number"
            min={1}
            value={formMaxPerHour}
            onChange={(e) => setFormMaxPerHour(e.target.value)}
            placeholder="1000"
          />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Quota"
      >
        <div className="space-y-4">
          <p className="text-mac-dark-gray">
            Are you sure you want to delete the rate limit for{" "}
            <span className="font-semibold text-mac-black">
              {deleteTarget ? getAgentName(deleteTarget.agent_id) : ""}
            </span>
            ? This action cannot be undone.
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
              {deleting ? "Deleting..." : "Delete Quota"}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
