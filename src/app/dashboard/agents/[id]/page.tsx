import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAgentStats } from "@/lib/agent-stats";
import * as agentsRepo from "@/lib/db/repos/agents";
import { getDb } from "@/lib/db/client";
import { agentUpdates, problems, tasks } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { Json } from "@/lib/database.types";
import { StatusHeader } from "@/components/agents/status-header";
import { HealthSparkline } from "@/components/agents/health-sparkline";
import { PerformanceCards } from "@/components/agents/performance-cards";
import { Timeline } from "@/components/agents/timeline";
import { AgentProblemsPanel } from "@/components/agents/agent-problems-panel";
import { AgentTasksPanel } from "@/components/agents/agent-tasks-panel";
import { MetadataViewer } from "@/components/agents/metadata-viewer";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const agent = await agentsRepo.findById(id);

  return {
    title: agent ? `${agent.name} | Doop` : "Agent Detail | Doop",
  };
}

interface AgentDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AgentDetailPage({ params }: AgentDetailPageProps) {
  const { id } = await params;

  const agent = await agentsRepo.findById(id);
  if (!agent) {
    notFound();
  }

  const db = getDb();

  // eslint-disable-next-line react-hooks/purity -- server component runs per-request, Date.now() is intentional
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [updatesRows, problemsRows, tasksRows, stats] = await Promise.all([
    db
      .select()
      .from(agentUpdates)
      .where(eq(agentUpdates.agentId, id))
      .orderBy(desc(agentUpdates.createdAt))
      .limit(50),
    db.select().from(problems).where(eq(problems.agentId, id)).orderBy(desc(problems.createdAt)),
    db.select().from(tasks).where(eq(tasks.agentId, id)).orderBy(desc(tasks.createdAt)),
    getAgentStats(id),
  ]);

  // Filter updates from last 7 days for sparkline (HealthSparkline expects snake_case shape)
  const recentUpdates = updatesRows
    .filter((u) => u.createdAt && u.createdAt >= sevenDaysAgo)
    .map((u) => ({
      health: u.health,
      created_at: u.createdAt?.toISOString() ?? null,
    }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <StatusHeader agent={agent} />
        </div>
        <div className="hidden sm:block">
          <HealthSparkline updates={recentUpdates} currentHealth={agent.health} />
        </div>
      </div>

      <PerformanceCards stats={stats} />

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          <Timeline agentId={id} initialUpdates={updatesRows} />
          <MetadataViewer metadata={agent.metadata as Json} />
        </div>
        <div className="space-y-6">
          <AgentProblemsPanel agentId={id} initialProblems={problemsRows} />
          <AgentTasksPanel agentId={id} initialTasks={tasksRows} />
        </div>
      </div>
    </div>
  );
}
