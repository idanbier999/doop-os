import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { agents, agentUpdates, activityLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { withRateLimit } from "@/lib/api-rate-limit";

const heartbeatBodySchema = z
  .object({
    status: z.string().max(50).optional(),
    stage: z.enum(["idle", "running", "blocked", "completed", "error"]).optional(),
    health: z.enum(["healthy", "degraded", "critical", "offline"]).optional(),
    message: z.string().max(500).optional(),
    version: z.string().max(100).optional(),
    meta: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

async function handlePost(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional body — may be empty
  let body: z.infer<typeof heartbeatBodySchema> = {};
  try {
    const raw = await request.json();
    const parsed = heartbeatBodySchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request body", details: parsed.error.issues },
        { status: 422 }
      );
    }
    body = parsed.data;
  } catch {
    // Body is empty or invalid JSON — that's fine, all fields are optional
  }

  const db = getDb();

  // Build metadata patch to merge with existing
  const metadataPatch: Record<string, unknown> = {};
  if (body.version) metadataPatch.version = body.version;
  if (body.meta) metadataPatch.meta = body.meta;

  // Fetch existing metadata so we can merge, not overwrite
  let mergedMetadata: Record<string, unknown> | undefined;
  if (Object.keys(metadataPatch).length > 0) {
    const existing = await db
      .select({ metadata: agents.metadata })
      .from(agents)
      .where(eq(agents.id, agent.id))
      .limit(1);
    const prev = (existing[0]?.metadata as Record<string, unknown>) ?? {};
    mergedMetadata = { ...prev, ...metadataPatch };
  }

  // Use provided health/stage or default to "healthy"
  const healthValue = body.health ?? "healthy";
  const hasStatusUpdate = body.stage || body.health || body.message;

  const agentUpdate: Partial<typeof agents.$inferInsert> = {
    lastSeenAt: new Date(),
    health: healthValue,
    ...(body.stage ? { stage: body.stage } : {}),
    ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
  };

  try {
    await db.update(agents).set(agentUpdate).where(eq(agents.id, agent.id));
  } catch {
    return NextResponse.json({ error: "Failed to update heartbeat" }, { status: 500 });
  }

  // If stage/health/message provided, record in agent_updates and activity_log
  if (hasStatusUpdate) {
    await db.insert(agentUpdates).values({
      agentId: agent.id,
      stage: body.stage ?? null,
      health: healthValue,
      message: body.message ?? null,
      details: body.meta ?? null,
    });

    await db.insert(activityLog).values({
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      action: "status_update",
      details: {
        stage: body.stage ?? null,
        health: healthValue,
        message: body.message ?? null,
      },
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handlePost);
