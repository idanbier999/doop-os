"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { relativeTime } from "@/lib/utils";

type ProjectData = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  orchestration_mode: string;
  lead_agent_id: string | null;
  created_at: string | null;
  lead_agent?: { name: string } | null;
};

interface ProjectCardProps {
  project: ProjectData;
  taskTotal: number;
  taskCompleted: number;
  agentCount: number;
}

export function ProjectCard({ project, taskTotal, taskCompleted, agentCount }: ProjectCardProps) {
  const orchestrationLabel =
    project.orchestration_mode === "lead_agent" && project.lead_agent?.name
      ? `Lead: ${project.lead_agent.name}`
      : project.orchestration_mode === "lead_agent"
        ? "Lead Agent"
        : "Manual";

  return (
    <Link href={`/dashboard/projects/${project.id}`}>
      <div className="border-2 border-mac-border rounded-lg bg-mac-white p-4 hover:shadow-md transition-shadow cursor-pointer h-full flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-bold text-mac-black font-[family-name:var(--font-pixel)] line-clamp-1 flex-1">
            {project.name}
          </h3>
          <Badge variant="status" value={project.status} />
        </div>

        {/* Description */}
        {project.description && (
          <p className="text-xs text-mac-dark-gray line-clamp-2">{project.description}</p>
        )}

        {/* Stats row */}
        <div className="flex items-center gap-3 text-xs text-mac-dark-gray mt-auto">
          {/* Agent count */}
          <span className="flex items-center gap-1">
            <span className="text-base leading-none">◆</span>
            {agentCount} {agentCount === 1 ? "agent" : "agents"}
          </span>

          {/* Task progress */}
          <span className="flex items-center gap-1">
            <span className="text-base leading-none">▦</span>
            {taskCompleted}/{taskTotal} tasks
          </span>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-mac-gray border-t border-mac-border pt-2">
          <span className="font-[family-name:var(--font-pixel)]">{orchestrationLabel}</span>
          <span>{relativeTime(project.created_at)}</span>
        </div>
      </div>
    </Link>
  );
}
