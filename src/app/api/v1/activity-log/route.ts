import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authenticateAgent } from "@/lib/api-auth";
import { getDb } from "@/lib/db/client";
import { activityLog } from "@/lib/db/schema";
import { withRateLimit } from "@/lib/api-rate-limit";

const activityLogBodySchema = z
  .object({
    action: z.string().min(1).max(100),
    details: z.record(z.string(), z.unknown()).optional(),
  })
  .strict();

async function handlePost(request: NextRequest) {
  const agent = await authenticateAgent(request);
  if (!agent) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = activityLogBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request body", details: parsed.error.issues },
      { status: 422 }
    );
  }

  const { action, details } = parsed.data;
  const db = getDb();

  try {
    await db.insert(activityLog).values({
      workspaceId: agent.workspaceId,
      agentId: agent.id,
      action,
      details: details ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to log activity" }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export const POST = withRateLimit(handlePost);
