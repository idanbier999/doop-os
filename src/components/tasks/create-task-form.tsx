"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useWorkspace } from "@/contexts/workspace-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

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
  { value: "urgent", label: "Urgent" },
];

export function CreateTaskForm({ open, onClose, agents }: CreateTaskFormProps) {
  const { workspaceId, userId } = useWorkspace();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [agentId, setAgentId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const agentOptions = [
    { value: "", label: "None (unassigned)" },
    ...agents.map((a) => ({ value: a.id, label: a.name })),
  ];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setSubmitting(true);
    setError("");

    const supabase = createClient();
    const { error: insertError } = await supabase.from("tasks").insert({
      workspace_id: workspaceId,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      agent_id: agentId || null,
      assigned_to: null,
      created_by: userId,
      status: "pending",
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setTitle("");
    setDescription("");
    setPriority("medium");
    setAgentId("");
    onClose();
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
            className="block text-sm font-medium text-gray-300 mb-1"
          >
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Add more details..."
            rows={3}
            className="w-full rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-gray-100 placeholder-gray-500 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
        <Select
          label="Priority"
          id="task-priority"
          options={priorityOptions}
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
        />
        <Select
          label="Assign to Agent"
          id="task-agent"
          options={agentOptions}
          value={agentId}
          onChange={(e) => setAgentId(e.target.value)}
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
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
