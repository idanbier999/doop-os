import type { Metadata } from "next";
import { requireWorkspaceMembership } from "@/lib/workspace";
import { getDb } from "@/lib/db/client";
import { activityLog, agents as agentsTable } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import type { Json } from "@/lib/database.types";
import { ActivityTimeline } from "@/components/activity/activity-timeline";

export const metadata: Metadata = { title: "Audit Trail | Doop" };

export default async function ActivityPage() {
  const { workspace } = await requireWorkspaceMembership();
  const workspaceId = workspace.id;

  const db = getDb();

  const [entriesRows, agentRows] = await Promise.all([
    db
      .select({
        id: activityLog.id,
        action: activityLog.action,
        details: activityLog.details,
        createdAt: activityLog.createdAt,
        agentId: activityLog.agentId,
        userId: activityLog.userId,
        workspaceId: activityLog.workspaceId,
        agentName: agentsTable.name,
      })
      .from(activityLog)
      .leftJoin(agentsTable, eq(activityLog.agentId, agentsTable.id))
      .where(eq(activityLog.workspaceId, workspaceId))
      .orderBy(desc(activityLog.createdAt))
      .limit(200),
    db
      .select({ id: agentsTable.id, name: agentsTable.name })
      .from(agentsTable)
      .where(eq(agentsTable.workspaceId, workspaceId)),
  ]);

  // ActivityTimeline expects Tables<"activity_log"> & { agents? }
  // Tables<"activity_log"> = Drizzle's ActivityLogEntry (camelCase with Date objects)
  // We pass the raw data; Next.js RSC serializes Date -> string automatically.
  const serializedEntries = entriesRows.map((e) => ({
    id: e.id,
    action: e.action,
    details: (e.details ?? {}) as Json,
    createdAt: e.createdAt,
    agentId: e.agentId,
    userId: e.userId,
    workspaceId: e.workspaceId,
    agents: e.agentName ? { name: e.agentName } : null,
  }));

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-mac-black font-[family-name:var(--font-pixel)]">
        Audit Trail
      </h1>
      <ActivityTimeline initialEntries={serializedEntries} agents={agentRows} />
    </div>
  );
}
