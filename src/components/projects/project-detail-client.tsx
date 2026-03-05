"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtime } from "@/hooks/use-realtime";
import { useSupabase } from "@/hooks/use-supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { ToastContainer, type ToastData } from "@/components/ui/toast";
import { AgentProgressPanel, type ProjectAgentInfo } from "@/components/projects/agent-progress-panel";
import { ProjectKanban } from "@/components/projects/project-kanban";
import { relativeTime, formatDate } from "@/lib/utils";
import type { TaskWithAgents } from "@/lib/types";
import {
  updateProjectStatus,
  createProjectTask,
  addProjectFile,
  launchProject,
  dispatchTaskToAgent,
} from "@/app/dashboard/projects/actions";
import type { Tables } from "@/lib/database.types";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type Project = Tables<"projects"> & {
  lead_agent?: { id: string; name: string } | null;
};
type ProjectAgent = Tables<"project_agents"> & {
  agent: {
    id: string;
    name: string;
    health: string;
    stage: string;
    webhook_url?: string | null;
  };
};
type Task = Tables<"tasks"> & {
  task_agents?: Array<{
    agent_id: string;
    role: string;
    agents?: { name: string } | null;
  }> | null;
};
type TaskDependency = Tables<"task_dependencies">;
type ProjectFile = Tables<"project_files">;
type ActivityEntry = Tables<"activity_log">;

const TABS = ["overview", "tasks", "team", "files", "activity"] as const;
type Tab = (typeof TABS)[number];

const TAB_LABELS: Record<Tab, string> = {
  overview: "Overview",
  tasks: "Tasks",
  team: "Team",
  files: "Files",
  activity: "Activity",
};

const statusBadgeVariant: Record<string, string> = {
  draft: "stage",
  active: "health",
  paused: "severity",
  completed: "status",
  cancelled: "status",
};

const statusBadgeValue: Record<string, string> = {
  draft: "idle",
  active: "healthy",
  paused: "medium",
  completed: "completed",
  cancelled: "cancelled",
};

export interface ProjectDetailClientProps {
  project: Project;
  initialProjectAgents: ProjectAgent[];
  initialTasks: Task[];
  initialDependencies: TaskDependency[];
  initialFiles: ProjectFile[];
  initialActivity: ActivityEntry[];
  initialProblems: { id: string; task_id: string | null; severity: string; status: string }[];
  workspaceAgents: { id: string; name: string; health: string; stage: string }[];
  webhookStats: { agent_id: string; status: string }[];
  userRole: string;
  workspaceId: string;
}

export function ProjectDetailClient({
  project: initialProject,
  initialProjectAgents,
  initialTasks,
  initialDependencies,
  initialFiles,
  initialActivity,
  initialProblems,
  workspaceAgents,
  webhookStats,
  workspaceId,
}: ProjectDetailClientProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [project, setProject] = useState<Project>(initialProject);
  const [projectAgents, setProjectAgents] = useState<ProjectAgent[]>(initialProjectAgents);
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [dependencies, setDependencies] = useState<TaskDependency[]>(initialDependencies);
  const [files, setFiles] = useState<ProjectFile[]>(initialFiles);
  const [statusLoading, setStatusLoading] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [addFilesOpen, setAddFilesOpen] = useState(false);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  // Toast helpers
  const addToast = useCallback((toast: Omit<ToastData, "id">) => {
    setToasts((prev) => [...prev, { ...toast, id: crypto.randomUUID() }]);
  }, []);
  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Realtime handlers
  const handleProjectUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "UPDATE") {
        setProject((prev) => ({ ...prev, ...(payload.new as Partial<Project>) }));
      }
    },
    []
  );

  const handleTaskUpdate = useCallback(
    async (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const raw = payload.new as Task;
        // Re-fetch with join so task_agents enrichment is included
        const { data } = await supabase
          .from("tasks")
          .select("*, task_agents(agent_id, role, agents(name))")
          .eq("id", raw.id)
          .single();
        if (data) {
          setTasks((prev) => {
            const idx = prev.findIndex((t) => t.id === data.id);
            if (idx >= 0) {
              // Replace optimistic entry with enriched data
              const next = [...prev];
              next[idx] = data as Task;
              return next;
            }
            return [data as Task, ...prev];
          });
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Task;
        // Preserve task_agents — realtime payloads don't include joined data
        setTasks((prev) =>
          prev.map((t) =>
            t.id === updated.id ? { ...t, ...updated, task_agents: t.task_agents } : t
          )
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as { id: string };
        setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      }
    },
    [supabase]
  );

  const handleAgentUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        // Can't easily reconstruct full agent object from payload; skip for now
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as Partial<ProjectAgent> & { id: string };
        setProjectAgents((prev) =>
          prev.map((pa) => (pa.id === updated.id ? { ...pa, ...updated } : pa))
        );
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as { id: string };
        setProjectAgents((prev) => prev.filter((pa) => pa.id !== deleted.id));
      }
    },
    []
  );

  const handleFileUpdate = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        setFiles((prev) => [payload.new as ProjectFile, ...prev]);
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as { id: string };
        setFiles((prev) => prev.filter((f) => f.id !== deleted.id));
      }
    },
    []
  );

  useRealtime({
    table: "projects",
    filter: `id=eq.${project.id}`,
    onPayload: handleProjectUpdate,
  });
  useRealtime({
    table: "tasks",
    filter: `project_id=eq.${project.id}`,
    onPayload: handleTaskUpdate,
  });
  useRealtime({
    table: "project_agents",
    filter: `project_id=eq.${project.id}`,
    onPayload: handleAgentUpdate,
  });
  useRealtime({
    table: "project_files",
    filter: `project_id=eq.${project.id}`,
    onPayload: handleFileUpdate,
  });

  // Status change handler
  const handleStatusChange = useCallback(
    async (newStatus: string) => {
      setStatusLoading(true);
      try {
        // Use launchProject for draft -> active to trigger lead agent webhook
        const result =
          newStatus === "active" && project.status === "draft"
            ? await launchProject(project.id, workspaceId)
            : await updateProjectStatus(project.id, workspaceId, newStatus);

        if (result.success) {
          setProject((prev) => ({ ...prev, status: newStatus }));
          addToast({
            type: "info",
            title: `Project ${newStatus === "active" ? "launched" : newStatus}`,
            description: `Project status updated to ${newStatus}`,
          });
          router.refresh();
        } else {
          addToast({ type: "critical", title: "Error", description: result.error });
        }
      } finally {
        setStatusLoading(false);
      }
    },
    [project.id, project.status, workspaceId, addToast]
  );

  // Compute problem counts per task for Kanban view
  const problemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of initialProblems) {
      if (p.task_id) {
        counts[p.task_id] = (counts[p.task_id] || 0) + 1;
      }
    }
    return counts;
  }, [initialProblems]);

  // Compute agent progress info for Team tab
  const agentProgressInfos: ProjectAgentInfo[] = useMemo(() => {
    return projectAgents.map((pa) => {
      const agentTasks = tasks.filter(
        (t) =>
          t.agent_id === pa.agent_id ||
          t.task_agents?.some((ta) => ta.agent_id === pa.agent_id)
      );
      const completedTasks = agentTasks.filter((t) => t.status === "completed");
      const currentTask = agentTasks.find((t) => t.status === "in_progress") || null;

      const agentWebhooks = webhookStats.filter((w) => w.agent_id === pa.agent_id);
      const webhookStatus = {
        total: agentWebhooks.length,
        delivered: agentWebhooks.filter((w) => w.status === "delivered").length,
        failed: agentWebhooks.filter((w) => w.status === "failed").length,
        pending: agentWebhooks.filter((w) => w.status === "pending").length,
      };

      return {
        id: pa.id,
        agent_id: pa.agent_id,
        role: pa.role as "lead" | "member",
        status: pa.status as "idle" | "working" | "done" | "error",
        agent: pa.agent,
        currentTask: currentTask
          ? { id: currentTask.id, title: currentTask.title, status: currentTask.status }
          : null,
        taskStats: { total: agentTasks.length, completed: completedTasks.length },
        recentActivity: [],
        webhookStatus,
      };
    });
  }, [projectAgents, tasks, webhookStats]);

  return (
    <div className="space-y-5">
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="mac-window">
        <div className="mac-title-bar">
          <button className="mac-close-box" aria-label="Back" onClick={() => history.back()} />
          <span className="mac-title-bar-title">Project</span>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)] truncate">
                {project.name}
              </h1>
              {project.description && (
                <p className="mt-1 text-sm text-mac-dark-gray">{project.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge
                variant={statusBadgeVariant[project.status] as "stage" | "health" | "severity" | "status" | "priority"}
                value={statusBadgeValue[project.status] ?? project.status}
              >
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
              <span className="text-xs text-mac-gray font-[family-name:var(--font-pixel)] border border-mac-border px-2 py-0.5 rounded-md">
                {project.orchestration_mode === "lead_agent" ? "Lead Agent" : "Manual"}
              </span>
            </div>
          </div>

          {/* Status action buttons */}
          <div className="flex gap-2 flex-wrap">
            {project.status === "draft" && (
              <Button
                size="sm"
                variant="primary"
                disabled={statusLoading}
                onClick={() => handleStatusChange("active")}
                className="bg-green-700 border-green-700 hover:bg-green-800"
              >
                Launch Project
              </Button>
            )}
            {project.status === "active" && (
              <>
                <Button size="sm" variant="secondary" disabled={statusLoading} onClick={() => handleStatusChange("paused")}>
                  Pause
                </Button>
                <Button size="sm" variant="secondary" disabled={statusLoading} onClick={() => handleStatusChange("completed")}>
                  Complete
                </Button>
              </>
            )}
            {project.status === "paused" && (
              <>
                <Button size="sm" variant="primary" disabled={statusLoading} onClick={() => handleStatusChange("active")}>
                  Resume
                </Button>
                <Button size="sm" variant="danger" disabled={statusLoading} onClick={() => handleStatusChange("cancelled")}>
                  Cancel
                </Button>
              </>
            )}
            {(project.status === "completed" || project.status === "cancelled") && (
              <Button size="sm" variant="secondary" disabled={statusLoading} onClick={() => handleStatusChange("draft")}>
                Reopen as Draft
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-mac-border gap-0">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold font-[family-name:var(--font-pixel)] transition-colors ${
              activeTab === tab
                ? "border-b-2 border-mac-highlight text-mac-highlight"
                : "text-mac-dark-gray hover:text-mac-black"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "overview" && (
          <OverviewTab project={project} />
        )}
        {activeTab === "tasks" && (
          <TasksTab
            tasks={tasks}
            dependencies={dependencies}
            projectAgents={projectAgents}
            workspaceId={workspaceId}
            projectId={project.id}
            problemCounts={problemCounts}
            onCreateTask={() => setCreateTaskOpen(true)}
            addToast={addToast}
          />
        )}
        {activeTab === "team" && (
          <AgentProgressPanel agents={agentProgressInfos} projectId={project.id} />
        )}
        {activeTab === "files" && (
          <FilesTab
            files={files}
            workspaceId={workspaceId}
            projectId={project.id}
            supabase={supabase}
            onAddFiles={() => setAddFilesOpen(true)}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab activity={initialActivity} projectId={project.id} taskIds={tasks.map((t) => t.id)} />
        )}
      </div>

      {/* Create task modal */}
      <CreateTaskModal
        open={createTaskOpen}
        onClose={() => setCreateTaskOpen(false)}
        projectId={project.id}
        workspaceId={workspaceId}
        projectAgents={projectAgents}
        tasks={tasks}
        onCreated={(task) => {
          setTasks((prev) => [task, ...prev]);
          router.refresh();
        }}
        addToast={addToast}
      />

      {/* Add files modal */}
      <Modal open={addFilesOpen} onClose={() => setAddFilesOpen(false)} title="Add Files">
        <FileUpload
          workspaceId={workspaceId}
          projectId={project.id}
          onFilesUploaded={async (uploaded) => {
            for (const f of uploaded) {
              await addProjectFile({
                projectId: project.id,
                workspaceId,
                fileName: f.name,
                filePath: f.path,
                fileSize: f.size,
                mimeType: f.type,
              });
            }
            setAddFilesOpen(false);
            router.refresh();
          }}
        />
      </Modal>
    </div>
  );
}

// ─── Overview Tab ───────────────────────────────────────────────────────────

function OverviewTab({ project }: { project: Project }) {
  return (
    <div className="space-y-4">
      {project.instructions && (
        <div className="mac-window">
          <div className="mac-title-bar">
            <span className="mac-title-bar-title">Instructions</span>
          </div>
          <div className="p-4">
            <pre className="text-sm text-mac-dark-gray whitespace-pre-wrap font-body leading-relaxed">
              {project.instructions}
            </pre>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {project.lead_agent && (
          <div className="mac-window">
            <div className="mac-title-bar">
              <span className="mac-title-bar-title">Lead Agent</span>
            </div>
            <div className="p-4">
              <p className="text-sm font-bold text-mac-black">{project.lead_agent.name}</p>
            </div>
          </div>
        )}

        <div className="mac-window">
          <div className="mac-title-bar">
            <span className="mac-title-bar-title">Metadata</span>
          </div>
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-mac-gray font-[family-name:var(--font-pixel)]">Created</span>
              <span className="text-mac-dark-gray">{formatDate(project.created_at)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-mac-gray font-[family-name:var(--font-pixel)]">Updated</span>
              <span className="text-mac-dark-gray">{formatDate(project.updated_at)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-mac-gray font-[family-name:var(--font-pixel)]">Mode</span>
              <span className="text-mac-dark-gray capitalize">{project.orchestration_mode.replace("_", " ")}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Tasks Tab ───────────────────────────────────────────────────────────────

function TasksTab({
  tasks,
  dependencies,
  projectAgents,
  workspaceId,
  projectId,
  problemCounts,
  onCreateTask,
  addToast,
}: {
  tasks: Task[];
  dependencies: TaskDependency[];
  projectAgents: ProjectAgent[];
  workspaceId: string;
  projectId: string;
  problemCounts: Record<string, number>;
  onCreateTask: () => void;
  addToast: (toast: Omit<ToastData, "id">) => void;
}) {
  const [view, setView] = useState<"list" | "kanban">("list");
  const [dispatchingId, setDispatchingId] = useState<string | null>(null);

  const handleDispatchTask = useCallback(
    async (taskId: string) => {
      setDispatchingId(taskId);
      try {
        const result = await dispatchTaskToAgent(taskId, workspaceId);
        if (result.success) {
          const title = result.method === "queue" ? "Task queued for agent" : "Task dispatched";
          const description = result.method === "queue" ? "Agent will pick it up on next poll" : "Webhook sent to agent";
          addToast({ type: "info", title, description });
        } else {
          addToast({ type: "critical", title: "Dispatch failed", description: result.error });
        }
      } finally {
        setDispatchingId(null);
      }
    },
    [workspaceId, addToast]
  );
  // Build dependency maps
  const blockedBy = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const dep of dependencies) {
      if (!map[dep.task_id]) map[dep.task_id] = [];
      map[dep.task_id].push(dep.depends_on_task_id);
    }
    return map;
  }, [dependencies]);

  const blocks = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const dep of dependencies) {
      if (!map[dep.depends_on_task_id]) map[dep.depends_on_task_id] = [];
      map[dep.depends_on_task_id].push(dep.task_id);
    }
    return map;
  }, [dependencies]);

  const taskById = useMemo(() => {
    const map: Record<string, Task> = {};
    for (const t of tasks) map[t.id] = t;
    return map;
  }, [tasks]);

  const agentById = useMemo(() => {
    const map: Record<string, ProjectAgent["agent"]> = {};
    for (const pa of projectAgents) map[pa.agent_id] = pa.agent;
    return map;
  }, [projectAgents]);

  if (tasks.length === 0) {
    return (
      <div className="mac-window">
        <div className="mac-title-bar">
          <span className="mac-title-bar-title">Tasks</span>
          <Button size="sm" onClick={onCreateTask} className="ml-auto mr-2">
            + Add Task
          </Button>
        </div>
        <EmptyState
          message="No tasks yet"
          description="Add tasks to this project to track work"
          actionLabel="Add Task"
          onAction={onCreateTask}
        />
      </div>
    );
  }

  return (
    <div className="mac-window">
      <div className="mac-title-bar">
        <span className="mac-title-bar-title">Tasks ({tasks.length})</span>
        <div className="flex items-center gap-1 ml-auto mr-2">
          <button
            onClick={() => setView("list")}
            className={`px-1.5 py-0.5 text-xs font-bold font-[family-name:var(--font-pixel)] border rounded ${
              view === "list"
                ? "bg-mac-highlight text-mac-highlight-text border-mac-highlight"
                : "bg-mac-white text-mac-dark-gray border-mac-border hover:bg-mac-light-gray"
            }`}
            title="List view"
          >
            ☰
          </button>
          <button
            onClick={() => setView("kanban")}
            className={`px-1.5 py-0.5 text-xs font-bold font-[family-name:var(--font-pixel)] border rounded ${
              view === "kanban"
                ? "bg-mac-highlight text-mac-highlight-text border-mac-highlight"
                : "bg-mac-white text-mac-dark-gray border-mac-border hover:bg-mac-light-gray"
            }`}
            title="Kanban view"
          >
            ▦
          </button>
          <Button size="sm" onClick={onCreateTask}>
            + Add Task
          </Button>
        </div>
      </div>

      {view === "kanban" ? (
        <div className="p-4">
          <ProjectKanban
            initialTasks={tasks as unknown as TaskWithAgents[]}
            projectId={projectId}
            problemCounts={problemCounts}
            filters={{ status: "", priority: "", agentId: "" }}
            onTaskClick={() => {}}
          />
        </div>
      ) : (
        <div className="divide-y divide-mac-border">
          {tasks.map((task) => {
            const assignedAgents = task.task_agents || [];
            const taskBlockedBy = (blockedBy[task.id] || []).map((id) => taskById[id]?.title ?? id);
            const taskBlocks = (blocks[task.id] || []).map((id) => taskById[id]?.title ?? id);

            return (
              <div key={task.id} className="px-4 py-3 flex flex-col gap-1.5 hover:bg-mac-light-gray/40">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-mac-black flex-1 min-w-0 truncate">{task.title}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="status" value={task.status} />
                    <Badge variant="priority" value={task.priority} />
                    {task.agent_id && (task.status === "pending" || task.status === "waiting_on_agent") && (
                      <div className="flex items-center gap-1.5">
                        {task.status === "waiting_on_agent" && (
                          <span className="text-xs text-mac-gray">Queued</span>
                        )}
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={dispatchingId === task.id || task.status === "waiting_on_agent"}
                          onClick={() => handleDispatchTask(task.id)}
                        >
                          {dispatchingId === task.id ? "Sending..." : "Push to Agent"}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {task.description && (
                  <p className="text-xs text-mac-dark-gray truncate">{task.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-mac-gray flex-wrap">
                  {assignedAgents.length > 0 && (
                    <span className="flex items-center gap-1">
                      Agent:{" "}
                      {assignedAgents.map((ta, i) => {
                        const agent = agentById[ta.agent_id];
                        const health = agent?.health;
                        return (
                          <span key={ta.agent_id} className="inline-flex items-center gap-1">
                            {i > 0 && ", "}
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${health === "healthy" ? "bg-green-500" : "bg-gray-400"}`} />
                            {ta.agents?.name ?? ta.agent_id}
                          </span>
                        );
                      })}
                    </span>
                  )}
                  {taskBlockedBy.length > 0 && (
                    <span className="text-severity-high">
                      Blocked by: {taskBlockedBy.join(", ")}
                    </span>
                  )}
                  {taskBlocks.length > 0 && (
                    <span>Blocks: {taskBlocks.join(", ")}</span>
                  )}
                  <span className="ml-auto">{relativeTime(task.created_at)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Files Tab ───────────────────────────────────────────────────────────────

function FilesTab({
  files,
  workspaceId,
  projectId,
  supabase,
  onAddFiles,
}: {
  files: ProjectFile[];
  workspaceId: string;
  projectId: string;
  supabase: ReturnType<typeof useSupabase>;
  onAddFiles: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (file: ProjectFile) => {
      setDownloadingId(file.id);
      try {
        const { data } = await supabase.storage
          .from("project-files")
          .createSignedUrl(file.file_path, 3600);
        if (data?.signedUrl) {
          const a = document.createElement("a");
          a.href = data.signedUrl;
          a.download = file.file_name;
          a.click();
        }
      } finally {
        setDownloadingId(null);
      }
    },
    [supabase]
  );

  return (
    <div className="mac-window">
      <div className="mac-title-bar">
        <span className="mac-title-bar-title">Files ({files.length})</span>
        <Button size="sm" onClick={onAddFiles} className="ml-auto mr-2">
          + Add Files
        </Button>
      </div>
      {files.length === 0 ? (
        <EmptyState
          message="No files yet"
          description="Upload files to share context with agents"
          actionLabel="Add Files"
          onAction={onAddFiles}
        />
      ) : (
        <div className="divide-y divide-mac-border">
          {files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 px-4 py-3 hover:bg-mac-light-gray/40">
              <span className="text-lg shrink-0">&#128196;</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-mac-black truncate">{file.file_name}</p>
                <p className="text-xs text-mac-gray">
                  {file.file_size ? formatFileSize(file.file_size) : "Unknown size"} &bull;{" "}
                  {relativeTime(file.created_at)}
                </p>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={downloadingId === file.id}
                onClick={() => handleDownload(file)}
              >
                {downloadingId === file.id ? "..." : "Download"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Activity Tab ────────────────────────────────────────────────────────────

function ActivityTab({
  activity,
  projectId,
  taskIds,
}: {
  activity: ActivityEntry[];
  projectId: string;
  taskIds: string[];
}) {
  const filtered = useMemo(() => {
    return activity.filter((entry) => {
      const details = entry.details as Record<string, unknown> | null;
      if (!details) return false;
      if (details.project_id === projectId) return true;
      if (typeof details.task_id === "string" && taskIds.includes(details.task_id)) return true;
      return false;
    });
  }, [activity, projectId, taskIds]);

  if (filtered.length === 0) {
    return (
      <div className="mac-window">
        <div className="mac-title-bar">
          <span className="mac-title-bar-title">Activity</span>
        </div>
        <EmptyState message="No activity yet" description="Actions on this project will appear here" />
      </div>
    );
  }

  return (
    <div className="mac-window">
      <div className="mac-title-bar">
        <span className="mac-title-bar-title">Activity</span>
      </div>
      <div className="p-4">
        <div className="relative">
          {/* Vertical timeline line */}
          <div className="absolute left-[7px] top-2 bottom-2 w-px bg-mac-border" />
          <ul className="space-y-4">
            {filtered.map((entry) => (
              <li key={entry.id} className="flex gap-3 relative">
                <span className="mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-mac-highlight bg-mac-white z-10" />
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)]">
                      {entry.action.replace(/_/g, " ")}
                    </span>
                    <span className="text-xs text-mac-gray ml-auto shrink-0">
                      {relativeTime(entry.created_at)}
                    </span>
                  </div>
                  {entry.details && (
                    <p className="text-xs text-mac-dark-gray mt-0.5 truncate">
                      {formatActivityDetails(entry.details as Record<string, unknown>)}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function formatActivityDetails(details: Record<string, unknown>): string {
  const parts: string[] = [];
  if (typeof details.name === "string") parts.push(details.name);
  if (typeof details.title === "string") parts.push(details.title);
  if (typeof details.new_status === "string") parts.push(`Status: ${details.new_status}`);
  if (typeof details.orchestration_mode === "string") parts.push(`Mode: ${details.orchestration_mode}`);
  return parts.join(" — ");
}

// ─── Create Task Modal ────────────────────────────────────────────────────────

interface CreateTaskModalProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  workspaceId: string;
  projectAgents: ProjectAgent[];
  tasks: Task[];
  onCreated: (task: Task) => void;
  addToast: (toast: Omit<ToastData, "id">) => void;
}

function CreateTaskModal({
  open,
  onClose,
  projectId,
  workspaceId,
  projectAgents,
  tasks,
  onCreated,
  addToast,
}: CreateTaskModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState("medium");
  const [assignedAgentId, setAssignedAgentId] = useState("");
  const [dependsOn, setDependsOn] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!title.trim()) return;
      setLoading(true);
      try {
        const result = await createProjectTask({
          projectId,
          workspaceId,
          title: title.trim(),
          description: description.trim() || undefined,
          priority,
          assignedAgentId: assignedAgentId || undefined,
          dependsOnTaskIds: dependsOn.length > 0 ? dependsOn : undefined,
        });

        if (result.success) {
          onCreated({
            id: result.taskId!,
            workspace_id: workspaceId,
            project_id: projectId,
            title: title.trim(),
            description: description.trim() || null,
            priority,
            status: "pending",
            agent_id: assignedAgentId || null,
            assigned_to: null,
            result: null,
            created_by: null,
            created_at: new Date().toISOString(),
            updated_at: null,
            task_agents: [],
          });
          addToast({ type: "info", title: "Task created", description: title.trim() });
          setTitle("");
          setDescription("");
          setPriority("medium");
          setAssignedAgentId("");
          setDependsOn([]);
          onClose();
        } else {
          addToast({ type: "critical", title: "Error", description: result.error });
        }
      } finally {
        setLoading(false);
      }
    },
    [
      title,
      description,
      priority,
      assignedAgentId,
      dependsOn,
      projectId,
      workspaceId,
      onCreated,
      addToast,
      onClose,
    ]
  );

  const toggleDep = (taskId: string) => {
    setDependsOn((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Add Task">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
            Title *
          </label>
          <input
            className="w-full border border-mac-border rounded-lg px-3 py-1.5 text-sm bg-mac-white focus:outline-none focus:ring-1 focus:ring-mac-highlight"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            required
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
            Description
          </label>
          <textarea
            className="w-full border border-mac-border rounded-lg px-3 py-1.5 text-sm bg-mac-white focus:outline-none focus:ring-1 focus:ring-mac-highlight resize-none"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
              Priority
            </label>
            <select
              className="w-full border border-mac-border rounded-lg px-3 py-1.5 text-sm bg-mac-white focus:outline-none focus:ring-1 focus:ring-mac-highlight"
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
              Assign Agent
            </label>
            <select
              className="w-full border border-mac-border rounded-lg px-3 py-1.5 text-sm bg-mac-white focus:outline-none focus:ring-1 focus:ring-mac-highlight"
              value={assignedAgentId}
              onChange={(e) => setAssignedAgentId(e.target.value)}
            >
              <option value="">Unassigned</option>
              {projectAgents.map((pa) => (
                <option key={pa.agent_id} value={pa.agent_id}>
                  {pa.agent.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {tasks.length > 0 && (
          <div>
            <label className="block text-xs font-bold text-mac-dark-gray mb-1 font-[family-name:var(--font-pixel)]">
              Depends On (blocked by)
            </label>
            <div className="border border-mac-border rounded-lg divide-y divide-mac-border max-h-32 overflow-y-auto">
              {tasks.map((t) => (
                <label
                  key={t.id}
                  className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-mac-light-gray/40"
                >
                  <input
                    type="checkbox"
                    checked={dependsOn.includes(t.id)}
                    onChange={() => toggleDep(t.id)}
                    className="accent-mac-highlight"
                  />
                  <span className="text-xs text-mac-dark-gray truncate">{t.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end pt-1">
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" size="sm" disabled={loading || !title.trim()}>
            {loading ? "Creating..." : "Create Task"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
