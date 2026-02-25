"use client";

import { useState, useEffect, useCallback } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import { useWorkspace } from "@/contexts/workspace-context";
import { useNotifications } from "@/contexts/notification-context";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { AgentMultiSelect } from "@/components/ui/agent-multi-select";
import type { AgentAssignment } from "@/components/ui/agent-multi-select";
import { TaskComments } from "./task-comments";
import { TaskProblems } from "./task-problems";
import { TaskResultViewer } from "./task-result-viewer";
import { TaskActivity } from "./task-activity";
import { relativeTime } from "@/lib/utils";
import type { TaskWithAgents } from "@/lib/types";

interface TaskDetailDrawerProps {
  task: TaskWithAgents | null;
  open: boolean;
  onClose: () => void;
  agents?: { id: string; name: string }[];
}

const statusOptions = [
  { label: "Pending", value: "pending" },
  { label: "In Progress", value: "in_progress" },
  { label: "Waiting on Agent", value: "waiting_on_agent" },
  { label: "Waiting on Human", value: "waiting_on_human" },
  { label: "Completed", value: "completed" },
  { label: "Cancelled", value: "cancelled" },
];

const priorityOptions = [
  { label: "Low", value: "low" },
  { label: "Medium", value: "medium" },
  { label: "High", value: "high" },
  { label: "Urgent", value: "urgent" },
];

type Tab = "comments" | "problems" | "result" | "activity";

const tabs: { key: Tab; label: string }[] = [
  { key: "comments", label: "Comments" },
  { key: "problems", label: "Problems" },
  { key: "result", label: "Result" },
  { key: "activity", label: "Activity" },
];

export function TaskDetailDrawer({ task, open, onClose, agents }: TaskDetailDrawerProps) {
  const [activeTab, setActiveTab] = useState<Tab>("comments");
  const [updating, setUpdating] = useState(false);
  const { workspaceId, userId } = useWorkspace();
  const { addToast } = useNotifications();
  const supabase = useSupabase();

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Reset tab when task changes
  useEffect(() => {
    setActiveTab("comments");
  }, [task?.id]);

  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      if (!task) return;
      setUpdating(true);
      try {
        const oldStatus = task.status;
        const { error } = await supabase.from("tasks").update({ status: newStatus }).eq("id", task.id);
        if (error) throw error;
        await supabase.from("activity_log").insert({
          workspace_id: workspaceId,
          agent_id: null,
          user_id: userId,
          action: "task_updated",
          details: {
            task_id: task.id,
            field: "status",
            old_value: oldStatus,
            new_value: newStatus,
          },
        });
      } catch {
        addToast({ type: "warning", title: "Failed to update task", description: "Please try again" });
      } finally {
        setUpdating(false);
      }
    },
    [task, workspaceId, userId, addToast, supabase]
  );

  const handlePriorityChange = useCallback(
    async (newPriority: string) => {
      if (!task) return;
      setUpdating(true);
      try {
        const oldPriority = task.priority;
        const { error } = await supabase.from("tasks").update({ priority: newPriority }).eq("id", task.id);
        if (error) throw error;
        await supabase.from("activity_log").insert({
          workspace_id: workspaceId,
          agent_id: null,
          user_id: userId,
          action: "task_updated",
          details: {
            task_id: task.id,
            field: "priority",
            old_value: oldPriority,
            new_value: newPriority,
          },
        });
      } catch {
        addToast({ type: "warning", title: "Failed to update task", description: "Please try again" });
      } finally {
        setUpdating(false);
      }
    },
    [task, workspaceId, userId, addToast, supabase]
  );

  const handleAgentsChange = useCallback(
    async (newAssignments: AgentAssignment[]) => {
      if (!task) return;
      setUpdating(true);
      try {
        const currentAssignments: AgentAssignment[] = (task.task_agents ?? []).map((ta) => ({
          agent_id: ta.agent_id,
          role: ta.role as "primary" | "helper",
        }));

        const currentIds = new Set(currentAssignments.map((a) => a.agent_id));
        const newIds = new Set(newAssignments.map((a) => a.agent_id));

        // Determine removed agents
        const removed = currentAssignments.filter((a) => !newIds.has(a.agent_id));
        // Determine added agents
        const added = newAssignments.filter((a) => !currentIds.has(a.agent_id));
        // Determine role changes (agents that exist in both but role changed)
        const roleChanges = newAssignments.filter((a) => {
          const cur = currentAssignments.find((c) => c.agent_id === a.agent_id);
          return cur && cur.role !== a.role;
        });

        // Delete removed
        for (const r of removed) {
          const { error: delErr } = await supabase.from("task_agents").delete().eq("task_id", task.id).eq("agent_id", r.agent_id);
          if (delErr) throw delErr;
        }

        // Demote old primary before promoting new one (partial unique index)
        const oldPrimary = currentAssignments.find((a) => a.role === "primary");
        const newPrimary = newAssignments.find((a) => a.role === "primary");
        if (oldPrimary && newPrimary && oldPrimary.agent_id !== newPrimary.agent_id) {
          // Only demote if old primary is still in the list
          if (newIds.has(oldPrimary.agent_id)) {
            const { error: demoteErr } = await supabase.from("task_agents").update({ role: "helper" }).eq("task_id", task.id).eq("agent_id", oldPrimary.agent_id);
            if (demoteErr) throw demoteErr;
          }
        }

        // Insert added
        for (const a of added) {
          const { error: insErr } = await supabase.from("task_agents").insert({ task_id: task.id, agent_id: a.agent_id, role: a.role });
          if (insErr) throw insErr;
        }

        // Update role changes (excluding the demotion we already handled)
        for (const rc of roleChanges) {
          if (oldPrimary && rc.agent_id === oldPrimary.agent_id && rc.role === "helper") continue; // already handled
          const { error: updErr } = await supabase.from("task_agents").update({ role: rc.role }).eq("task_id", task.id).eq("agent_id", rc.agent_id);
          if (updErr) throw updErr;
        }

        // Also update tasks.agent_id for backward compat (trigger handles this, but let's be safe for immediate UI)
        const primaryAgent = newAssignments.find((a) => a.role === "primary");
        await supabase.from("tasks").update({ agent_id: primaryAgent?.agent_id ?? null }).eq("id", task.id);

        // Log activity
        await supabase.from("activity_log").insert({
          workspace_id: workspaceId,
          agent_id: null,
          user_id: userId,
          action: "task_updated",
          details: {
            task_id: task.id,
            field: "agents",
            added: added.map((a) => a.agent_id),
            removed: removed.map((a) => a.agent_id),
            role_changes: roleChanges.map((a) => ({ agent_id: a.agent_id, role: a.role })),
          },
        });
      } catch {
        addToast({ type: "warning", title: "Failed to update agents", description: "Please try again" });
      } finally {
        setUpdating(false);
      }
    },
    [task, workspaceId, userId, addToast, supabase]
  );

  return (
    <div
      className={`fixed inset-0 z-50 transition-opacity duration-200 ${
        open ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
      }`}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 glass-overlay" onClick={onClose} />

      {/* Drawer panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full sm:w-[480px] sm:border-l border-mac-border-strong bg-mac-white flex flex-col shadow-[−4px_0_16px_rgba(74,78,105,0.12)] transition-transform duration-200 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Title bar */}
        <div className="mac-title-bar shrink-0">
          <button onClick={onClose} className="mac-close-box" aria-label="Close" />
          <span className="mac-title-bar-title max-w-[300px] truncate">
            Task: {task?.title ?? "..."}
          </span>
        </div>

        {task && (
          <>
            {/* Header section */}
            <div className="shrink-0 border-b border-mac-border p-4 font-[family-name:var(--font-pixel)]">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="status" value={task.status} />
                <Badge variant="priority" value={task.priority} />
              </div>
              <p className="text-sm text-mac-dark-gray">
                {task.task_agents && task.task_agents.length > 0
                  ? `Agents: ${task.task_agents.map((ta) => `${ta.agents?.name ?? "?"}${ta.role === "primary" ? " (primary)" : ""}`).join(", ")}`
                  : `Agent: ${task.agents?.name ?? "Unassigned"}`}
              </p>
              <p className="text-xs text-mac-gray mt-1">
                Created: {relativeTime(task.created_at)}
              </p>
              {task.description && (
                <div className="mt-3">
                  <p className="text-xs font-bold text-mac-dark-gray mb-1">Description:</p>
                  <p className="text-sm text-mac-black whitespace-pre-wrap">
                    {task.description}
                  </p>
                </div>
              )}
              {!task.description && (
                <div className="mt-3">
                  <p className="text-xs text-mac-gray">No description</p>
                </div>
              )}
            </div>

            {/* Tab bar */}
            <div className="shrink-0 flex border-b border-mac-border font-[family-name:var(--font-pixel)]">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex-1 px-3 py-2 text-sm font-bold transition-colors duration-150 ${
                    activeTab === tab.key
                      ? "border-b-2 border-mac-highlight text-mac-highlight bg-mac-white"
                      : "text-mac-dark-gray hover:bg-mac-highlight-soft"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-y-auto">
              {activeTab === "comments" && <TaskComments taskId={task.id} />}
              {activeTab === "problems" && <TaskProblems taskId={task.id} />}
              {activeTab === "result" && <TaskResultViewer result={task.result} />}
              {activeTab === "activity" && (
                <TaskActivity taskId={task.id} workspaceId={workspaceId} />
              )}
            </div>

            {/* Actions footer */}
            <div className="shrink-0 border-t border-mac-border p-4 font-[family-name:var(--font-pixel)] overflow-visible">
              <div className="flex gap-3">
                <div className="flex-1">
                  <Select
                    label="Status"
                    options={statusOptions}
                    value={task.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    disabled={updating}
                  />
                </div>
                <div className="flex-1">
                  <Select
                    label="Priority"
                    options={priorityOptions}
                    value={task.priority}
                    onChange={(e) => handlePriorityChange(e.target.value)}
                    disabled={updating}
                  />
                </div>
                <div className="flex-1">
                  <AgentMultiSelect
                    label="Agents"
                    agents={agents ?? []}
                    selected={
                      (task.task_agents ?? []).map((ta) => ({
                        agent_id: ta.agent_id,
                        role: ta.role as "primary" | "helper",
                      }))
                    }
                    onChange={handleAgentsChange}
                    disabled={updating}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
