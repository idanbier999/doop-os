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
  boardId?: string;
}

const priorityOptions = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "urgent", label: "Urgent" },
];

export function CreateTaskForm({ open, onClose, agents, boardId }: CreateTaskFormProps) {
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
      board_id: boardId || null,
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
            className="w-full rounded-[2px] border border-mac-black bg-mac-white px-3 py-2 text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
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
        {error && <p className="text-sm text-[#CC0000] font-[family-name:var(--font-pixel)]">{error}</p>}
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
