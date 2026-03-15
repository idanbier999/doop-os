"use client";

import { useState, useMemo, useCallback } from "react";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ProjectCard } from "@/components/projects/project-card";
import { CreateProjectWizard } from "@/components/projects/create-project-wizard";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  orchestration_mode: string;
  lead_agent_id: string | null;
  workspace_id: string;
  created_at: string | null;
  updated_at: string | null;
  created_by: string | null;
  instructions: string | null;
  project_agents: { count: number }[];
  lead_agent: { name: string } | null;
};

type TaskStat = {
  project_id: string | null;
  status: string;
};

type AgentOption = {
  id: string;
  name: string;
  health: string;
  agent_type?: string | null;
};

interface ProjectsPageClientProps {
  initialProjects: ProjectRow[];
  taskStats: TaskStat[];
  agents: AgentOption[];
}

const PROJECT_STATUSES = ["draft", "active", "paused", "completed", "cancelled"];

export function ProjectsPageClient({
  initialProjects,
  taskStats,
  agents,
}: ProjectsPageClientProps) {
  const { workspaceId } = useWorkspace();
  const [projects, setProjects] = useState<ProjectRow[]>(initialProjects);
  const [statusFilter, setStatusFilter] = useState("");
  const [wizardOpen, setWizardOpen] = useState(false);

  const handleRealtimePayload = useCallback(
    (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
      if (payload.eventType === "INSERT") {
        const newProject = payload.new as unknown as ProjectRow;
        if (newProject.workspace_id === workspaceId) {
          setProjects((prev) => [newProject, ...prev]);
        }
      } else if (payload.eventType === "UPDATE") {
        const updated = payload.new as unknown as ProjectRow;
        setProjects((prev) => prev.map((p) => (p.id === updated.id ? { ...p, ...updated } : p)));
      } else if (payload.eventType === "DELETE") {
        const deleted = payload.old as unknown as { id: string };
        setProjects((prev) => prev.filter((p) => p.id !== deleted.id));
      }
    },
    [workspaceId]
  );

  useRealtime({
    table: "projects",
    filter: `workspace_id=eq.${workspaceId}`,
    onPayload: handleRealtimePayload,
  });

  const taskStatsByProject = useMemo(() => {
    const map: Record<string, { total: number; completed: number }> = {};
    for (const ts of taskStats) {
      if (!ts.project_id) continue;
      if (!map[ts.project_id]) map[ts.project_id] = { total: 0, completed: 0 };
      map[ts.project_id].total++;
      if (ts.status === "completed") map[ts.project_id].completed++;
    }
    return map;
  }, [taskStats]);

  const filteredProjects = useMemo(() => {
    if (!statusFilter) return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
          Projects
        </h1>
        <Button variant="primary" onClick={() => setWizardOpen(true)}>
          + New Project
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black font-[family-name:var(--font-pixel)] shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
        >
          <option value="">All Statuses</option>
          {PROJECT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </option>
          ))}
        </select>
      </div>

      {filteredProjects.length === 0 ? (
        <EmptyState
          message="No projects found"
          description={
            projects.length === 0
              ? "No projects yet. Create one to get started."
              : "No projects match the current filters."
          }
          {...(projects.length === 0 && {
            actionLabel: "+ New Project",
            onAction: () => setWizardOpen(true),
          })}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project) => {
            const stats = taskStatsByProject[project.id] ?? { total: 0, completed: 0 };
            const agentCount = project.project_agents?.[0]?.count ?? 0;
            return (
              <ProjectCard
                key={project.id}
                project={project}
                taskTotal={stats.total}
                taskCompleted={stats.completed}
                agentCount={agentCount}
              />
            );
          })}
        </div>
      )}

      <CreateProjectWizard open={wizardOpen} onClose={() => setWizardOpen(false)} agents={agents} />
    </div>
  );
}
