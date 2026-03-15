import { NextRequest, NextResponse } from "next/server";
import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { withRateLimit } from "@/lib/api-rate-limit";
import type { Json } from "@/lib/database.types";

async function handlePost(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Parse optional body — may be empty
  let body: { status?: string; version?: string; meta?: Record<string, unknown> } = {};
  try {
    body = await request.json();
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

  const { error } = await supabase
    .from("agents")
    .update({
      last_seen_at: new Date().toISOString(),
      health: "healthy",
      ...(mergedMetadata !== undefined ? { metadata: mergedMetadata } : {}),
    })
    .eq("id", agent.id);

  if (error) {
    return NextResponse.json({ error: "Failed to update heartbeat" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export const POST = withRateLimit(handlePost);
