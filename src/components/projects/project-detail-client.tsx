"use client";

import { useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { FileUpload } from "@/components/ui/file-upload";
import { ToastContainer, type ToastData } from "@/components/ui/toast";
import {
  AgentProgressPanel,
  type ProjectAgentInfo,
} from "@/components/projects/agent-progress-panel";
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
import type { ChangeEvent } from "@/hooks/use-realtime-events";

type Project = Tables<"projects"> & {
  lead_agent?: { id: string; name: string } | null;
};
type ProjectAgent = Tables<"project_agents"> & {
  agent: {
    id: string;
    name: string;
    health: string;
    stage: string;
    webhookUrl?: string | null;
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
  initialProblems: { id: string; taskId: string | null; severity: string; status: string }[];
  workspaceAgents: { id: string; name: string; health: string; stage: string }[];
  webhookStats: { agentId: string; status: string }[];
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

  // Realtime handlers — SSE-based
  const handleProjectEvent = useCallback((event: ChangeEvent) => {
    if (event.table !== "projects") return;
    if (event.event === "UPDATE") {
      setProject((prev) => ({ ...prev, ...(event.new as Partial<Project>) }));
    }
  }, []);

  const handleTaskEvent = useCallback(
    (event: ChangeEvent) => {
      if (event.table !== "tasks") return;
      if (event.event === "INSERT") {
        const raw = event.new as Task;
        if (raw.projectId !== project.id) return;
        // SSE payloads don't include joined data — trigger server re-fetch
        router.refresh();
      } else if (event.event === "UPDATE") {
        const updated = event.new as Task;
        // Preserve task_agents — SSE payloads don't include joined data
        setTasks((prev) =>
          prev.map((t) =>
            t.id === updated.id ? { ...t, ...updated, task_agents: t.task_agents } : t
          )
        );
      } else if (event.event === "DELETE") {
        const deleted = event.old as { id: string };
        setTasks((prev) => prev.filter((t) => t.id !== deleted.id));
      }
    },
    [project.id, router]
  );

  const handleAgentEvent = useCallback((event: ChangeEvent) => {
    if (event.table !== "project_agents") return;
    if (event.event === "UPDATE") {
      const updated = event.new as Partial<ProjectAgent> & { id: string };
      setProjectAgents((prev) =>
        prev.map((pa) => (pa.id === updated.id ? { ...pa, ...updated } : pa))
      );
    } else if (event.event === "DELETE") {
      const deleted = event.old as { id: string };
      setProjectAgents((prev) => prev.filter((pa) => pa.id !== deleted.id));
    }
  }, []);

  const handleFileEvent = useCallback((event: ChangeEvent) => {
    if (event.table !== "project_files") return;
    if (event.event === "INSERT") {
      setFiles((prev) => [event.new as ProjectFile, ...prev]);
    } else if (event.event === "DELETE") {
      const deleted = event.old as { id: string };
      setFiles((prev) => prev.filter((f) => f.id !== deleted.id));
    }
  }, []);

  // Single SSE connection filters on the client side by table
  useRealtimeEvents({ table: "projects", onEvent: handleProjectEvent });
  useRealtimeEvents({ table: "tasks", onEvent: handleTaskEvent });
  useRealtimeEvents({ table: "project_agents", onEvent: handleAgentEvent });
  useRealtimeEvents({ table: "project_files", onEvent: handleFileEvent });

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
    [project.id, project.status, workspaceId, addToast, router]
  );

  // Compute problem counts per task for Kanban view
  const problemCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of initialProblems) {
      if (p.taskId) {
        counts[p.taskId] = (counts[p.taskId] || 0) + 1;
      }
    }
    return counts;
  }, [initialProblems]);

  // Compute agent progress info for Team tab
  const agentProgressInfos: ProjectAgentInfo[] = useMemo(() => {
    return projectAgents.map((pa) => {
      const agentTasks = tasks.filter(
        (t) => t.agentId === pa.agentId || t.task_agents?.some((ta) => ta.agent_id === pa.agentId)
      );
      const completedTasks = agentTasks.filter((t) => t.status === "completed");
      const currentTask = agentTasks.find((t) => t.status === "in_progress") || null;

      const agentWebhooks = webhookStats.filter((w) => w.agentId === pa.agentId);
      const webhookStatus = {
        total: agentWebhooks.length,
        delivered: agentWebhooks.filter((w) => w.status === "delivered").length,
        failed: agentWebhooks.filter((w) => w.status === "failed").length,
        pending: agentWebhooks.filter((w) => w.status === "pending").length,
      };

      return {
        id: pa.id,
        agent_id: pa.agentId,
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
                variant={
                  statusBadgeVariant[project.status] as
                    | "stage"
                    | "health"
                    | "severity"
                    | "status"
                    | "priority"
                }
                value={statusBadgeValue[project.status] ?? project.status}
              >
                {project.status.charAt(0).toUpperCase() + project.status.slice(1)}
              </Badge>
              <span className="text-xs text-mac-gray font-[family-name:var(--font-pixel)] border border-mac-border px-2 py-0.5 rounded-md">
                {project.orchestrationMode === "lead_agent" ? "Lead Agent" : "Manual"}
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
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={statusLoading}
                  onClick={() => handleStatusChange("paused")}
                >
                  Pause
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={statusLoading}
                  onClick={() => handleStatusChange("completed")}
                >
                  Complete
                </Button>
              </>
            )}
            {project.status === "paused" && (
              <>
                <Button
                  size="sm"
                  variant="primary"
                  disabled={statusLoading}
                  onClick={() => handleStatusChange("active")}
                >
                  Resume
                </Button>
                <Button
                  size="sm"
                  variant="danger"
                  disabled={statusLoading}
                  onClick={() => handleStatusChange("cancelled")}
                >
                  Cancel
                </Button>
              </>
            )}
            {(project.status === "completed" || project.status === "cancelled") && (
              <Button
                size="sm"
                variant="secondary"
                disabled={statusLoading}
                onClick={() => handleStatusChange("draft")}
              >
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
        {activeTab === "overview" && <OverviewTab project={project} />}
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
            onAddFiles={() => setAddFilesOpen(true)}
          />
        )}
        {activeTab === "activity" && (
          <ActivityTab
            activity={initialActivity}
            projectId={project.id}
            taskIds={tasks.map((t) => t.id)}
          />
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
              <span className="text-mac-dark-gray">{formatDate(project.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-mac-gray font-[family-name:var(--font-pixel)]">Updated</span>
              <span className="text-mac-dark-gray">{formatDate(project.updatedAt)}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-mac-gray font-[family-name:var(--font-pixel)]">Mode</span>
              <span className="text-mac-dark-gray capitalize">
                {project.orchestrationMode.replace("_", " ")}
              </span>
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
          addToast({
            type: "info",
            title: "Task dispatched",
            description: "Webhook sent to agent",
          });
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
      if (!map[dep.taskId]) map[dep.taskId] = [];
      map[dep.taskId].push(dep.dependsOnTaskId);
    }
    return map;
  }, [dependencies]);

  const blocks = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const dep of dependencies) {
      if (!map[dep.dependsOnTaskId]) map[dep.dependsOnTaskId] = [];
      map[dep.dependsOnTaskId].push(dep.taskId);
    }
    return map;
  }, [dependencies]);

  const taskById = useMemo(() => {
    const map: Record<string, Task> = {};
    for (const t of tasks) map[t.id] = t;
    return map;
  }, [tasks]);

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
              <div
                key={task.id}
                className="px-4 py-3 flex flex-col gap-1.5 hover:bg-mac-light-gray/40"
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-mac-black flex-1 min-w-0 truncate">
                    {task.title}
                  </span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="status" value={task.status} />
                    <Badge variant="priority" value={task.priority} />
                    {task.agentId && task.status === "pending" && (
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={dispatchingId === task.id}
                        onClick={() => handleDispatchTask(task.id)}
                      >
                        {dispatchingId === task.id ? "Sending..." : "Push to Agent"}
                      </Button>
                    )}
                  </div>
                </div>

                {task.description && (
                  <p className="text-xs text-mac-dark-gray truncate">{task.description}</p>
                )}

                <div className="flex items-center gap-3 text-xs text-mac-gray flex-wrap">
                  {assignedAgents.length > 0 && (
                    <span>
                      Agent: {assignedAgents.map((ta) => ta.agents?.name ?? ta.agent_id).join(", ")}
                    </span>
                  )}
                  {taskBlockedBy.length > 0 && (
                    <span className="text-severity-high">
                      Blocked by: {taskBlockedBy.join(", ")}
                    </span>
                  )}
                  {taskBlocks.length > 0 && <span>Blocks: {taskBlocks.join(", ")}</span>}
                  <span className="ml-auto">{relativeTime(task.createdAt)}</span>
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
  onAddFiles,
}: {
  files: ProjectFile[];
  workspaceId: string;
  projectId: string;
  onAddFiles: () => void;
}) {
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const handleDownload = useCallback(
    async (file: ProjectFile) => {
      setDownloadingId(file.id);
      try {
        const res = await fetch(`/api/v1/projects/${projectId}/files/${file.id}/download`);
        if (res.ok) {
          const data = await res.json();
          if (data?.signedUrl) {
            const a = document.createElement("a");
            a.href = data.signedUrl;
            a.download = file.fileName;
            a.click();
          }
        }
      } finally {
        setDownloadingId(null);
      }
    },
    [projectId]
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
            <div
              key={file.id}
              className="flex items-center gap-3 px-4 py-3 hover:bg-mac-light-gray/40"
            >
              <span className="text-lg shrink-0">&#128196;</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-mac-black truncate">{file.fileName}</p>
                <p className="text-xs text-mac-gray">
                  {file.fileSize ? formatFileSize(file.fileSize) : "Unknown size"} &bull;{" "}
                  {relativeTime(file.createdAt)}
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
        <EmptyState
          message="No activity yet"
          description="Actions on this project will appear here"
        />
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
                      {relativeTime(entry.createdAt)}
                    </span>
                  </div>
                  {entry.details != null ? (
                    <p className="text-xs text-mac-dark-gray mt-0.5 truncate">
                      {formatActivityDetails(entry.details as Record<string, unknown>)}
                    </p>
                  ) : null}
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
  if (typeof details.orchestration_mode === "string")
    parts.push(`Mode: ${details.orchestration_mode}`);
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
            workspaceId,
            projectId,
            title: title.trim(),
            description: description.trim() || null,
            priority,
            status: "pending",
            agentId: assignedAgentId || null,
            assignedTo: null,
            result: null,
            createdBy: null,
            createdAt: new Date(),
            updatedAt: null,
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
                <option key={pa.agentId} value={pa.agentId}>
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
