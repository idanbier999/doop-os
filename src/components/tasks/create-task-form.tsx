"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useWorkspace } from "@/contexts/workspace-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AgentMultiSelect } from "@/components/ui/agent-multi-select";
import type { AgentAssignment } from "@/components/ui/agent-multi-select";
import { createTask } from "@/app/dashboard/tasks/actions";

interface Agent {
  id: string;
  name: string;
}

interface CreateTaskFormProps {
  open: boolean;
  onClose: () => void;
  agents: Agent[];
}

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
];

export function CreateTaskForm({ open, onClose, agents }: CreateTaskFormProps) {
  const { workspaceId } = useWorkspace();
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [agentAssignments, setAgentAssignments] = useState<AgentAssignment[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError("");

    const result = await createTask({
      workspaceId,
      title: title.trim(),
      description: description.trim() || undefined,
      priority,
      agentAssignments: agentAssignments.map((a) => ({
        agent_id: a.agent_id,
        role: a.role,
      })),
    });

    setSubmitting(false);

    if (!result.success) {
      setError(result.error ?? "Failed to create task");
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("medium");
    setAgentAssignments([]);
    onClose();
    router.refresh();
  }

  return (
    <Modal open={open} onClose={onClose} title="Create Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Title"
          id="task-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What needs to be done?"
          required
        />
        <div>
          <label
            htmlFor="task-description"
            className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
          >
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more details..."
            rows={3}
            className="w-full rounded-md border border-mac-border bg-mac-white px-3 py-2 text-mac-black placeholder-mac-gray shadow-[inset_0px_1px_2px_rgba(74,78,105,0.08)] focus:outline-none focus:ring-2 focus:ring-mac-highlight/50"
          />
        </div>
        <Select
          label="Priority"
          id="task-priority"
          options={priorityOptions}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
        <AgentMultiSelect
          label="Assign to Agents"
          agents={agents}
          selected={agentAssignments}
          onChange={setAgentAssignments}
        />
        {error && (
          <p className="text-sm text-severity-critical font-[family-name:var(--font-pixel)]">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" type="button" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
