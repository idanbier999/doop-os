import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { problems, activityLog } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/auth/session";
import { requireWorkspaceMember, AuthorizationError } from "@/lib/db/auth";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const { status, workspaceId, agentId, problemTitle } = body;

  const validStatuses = ["open", "resolved", "dismissed"];
  if (!status || !workspaceId || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
  }

  try {
    await requireWorkspaceMember(user.id, workspaceId);
  } catch (err) {
    if (err instanceof AuthorizationError) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    throw err;
  }

  const db = getDb();

  const updateData: Record<string, unknown> = { status };
  if (status === "resolved" || status === "dismissed") {
    updateData.resolvedBy = user.id;
    updateData.resolvedAt = new Date();
  }

  await db.update(problems).set(updateData).where(eq(problems.id, id));

  await db.insert(activityLog).values({
    workspaceId,
    agentId: agentId || null,
    userId: user.id,
    action: `problem_${status}`,
    details: { problem_id: id, title: problemTitle },
  });

  return NextResponse.json({ success: true });
}
