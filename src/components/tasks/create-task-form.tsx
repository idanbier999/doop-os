"use client";

import { useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { Modal } from "@/components/ui/modal";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AgentMultiSelect } from "@/components/ui/agent-multi-select";
import type { AgentAssignment } from "@/components/ui/agent-multi-select";

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
  const supabase = useSupabase();
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

    const { data: inserted, error: insertError } = await supabase.from("tasks").insert({
      workspace_id: workspaceId,
      title: title.trim(),
      description: description.trim() || null,
      priority,
      agent_id: agentAssignments.find((a) => a.role === "primary")?.agent_id ?? null,
      assigned_to: null,
      created_by: userId,
      status: "pending",
      board_id: boardId || null,
    }).select("id").single();

    setSubmitting(false);

    if (insertError || !inserted) {
      setError(insertError?.message ?? "Failed to create task");
      return;
    }

    // Insert agent assignments into junction table
    if (agentAssignments.length > 0) {
      const { error: junctionError } = await supabase.from("task_agents").insert(
        agentAssignments.map((a) => ({
          task_id: inserted.id,
          agent_id: a.agent_id,
          role: a.role,
        }))
      );
      if (junctionError) {
        setError("Task created but agent assignment failed. Please assign agents manually.");
        console.error("Failed to insert task_agents:", junctionError.message);
        return;
      }
    }

    try {
      const primaryAgent = agentAssignments.find((a) => a.role === "primary");
      const agentName = primaryAgent ? agents.find((a) => a.id === primaryAgent.agent_id)?.name ?? null : null;
      await supabase.from("activity_log").insert({
        workspace_id: workspaceId,
        user_id: userId,
        agent_id: primaryAgent?.agent_id ?? null,
        action: "task_created",
        details: {
          task_id: inserted.id,
          title: title.trim(),
          priority,
          agent_name: agentName,
          agent_count: agentAssignments.length,
        },
      });
    } catch {
      // Best-effort: task was already created successfully
    }

    setTitle("");
    setDescription("");
    setPriority("medium");
    setAgentAssignments([]);
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
        {error && <p className="text-sm text-severity-critical font-[family-name:var(--font-pixel)]">{error}</p>}
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
