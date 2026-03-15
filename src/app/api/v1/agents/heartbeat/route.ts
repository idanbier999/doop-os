import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import type { Json } from "@/lib/database.types";

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

  const supabase = createAdminClient();

  // Build metadata patch to merge with existing
  const metadataPatch: Record<string, unknown> = {};
  if (body.version) metadataPatch.version = body.version;
  if (body.meta) metadataPatch.meta = body.meta;

  // Fetch existing metadata so we can merge, not overwrite
  let mergedMetadata: Json | undefined;
  if (Object.keys(metadataPatch).length > 0) {
    const { data: existing } = await supabase
      .from("agents")
      .select("metadata")
      .eq("id", agent.id)
      .single();
    const prev = (existing?.metadata as Record<string, unknown>) ?? {};
    mergedMetadata = { ...prev, ...metadataPatch } as Json;
  }

  // Use provided health/stage or default to "healthy"
  const healthValue = body.health ?? "healthy";
  const hasStatusUpdate = body.stage || body.health || body.message;

  const agentUpdate: Record<string, unknown> = {
    last_seen_at: new Date().toISOString(),
    health: healthValue,
    ...(body.stage ? { stage: body.stage } : {}),
    ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
  };

  const { error } = await supabase.from("agents").update(agentUpdate).eq("id", agent.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update heartbeat" }, { status: 500 });
  }

  // If stage/health/message provided, record in agent_updates and activity_log
  if (hasStatusUpdate) {
    await supabase.from("agent_updates").insert({
      agent_id: agent.id,
      stage: body.stage ?? null,
      health: healthValue,
      message: body.message ?? null,
      details: (body.meta as Json) ?? null,
    });

    await supabase.from("activity_log").insert({
      workspace_id: agent.workspace_id,
      agent_id: agent.id,
      action: "status_update",
      details: {
        stage: body.stage ?? null,
        health: healthValue,
        message: body.message ?? null,
      } as unknown as Json,
    });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handlePost);
