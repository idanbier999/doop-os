import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { sessions, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";
import { getUserWorkspaceIds } from "@/lib/db/auth";
import { dbEvents } from "@/lib/events/emitter";

const HEARTBEAT_INTERVAL_MS = 30_000;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // Parse cookie manually since cookies() may not be available in streaming context
  const cookieHeader = request.headers.get("cookie");
  const cookies = Object.fromEntries(
    (cookieHeader || "").split(";").map((c) => {
      const [key, ...val] = c.trim().split("=");
      return [key, val.join("=")];
    })
  );
  const token = cookies["doop-session"];
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Validate session and get user
  const db = getDb();
  const result = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.token, token), gt(sessions.expiresAt, new Date())))
    .limit(1);

  const userId = result[0]?.userId;
  if (!userId) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Get workspace IDs this user belongs to
  const workspaceIds = await getUserWorkspaceIds(userId);
  const workspaceSet = new Set(workspaceIds);

  // Create a readable stream that listens for events and pushes SSE data
  const encoder = new TextEncoder();
  let unsubscribe: (() => boolean) | null = null;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      // Subscribe to database events, filtering by workspace
      unsubscribe = dbEvents.on((event) => {
        if (!workspaceSet.has(event.workspaceId)) return;
        try {
          const data = JSON.stringify(event);
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          // Stream may be closed; ignore
        }
      });

      // Send heartbeat every 30 seconds to keep connection alive
      heartbeatTimer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          // Stream may be closed; clean up
          if (heartbeatTimer) clearInterval(heartbeatTimer);
          if (unsubscribe) unsubscribe();
        }
      }, HEARTBEAT_INTERVAL_MS);
    },
    cancel() {
      // Clean up on disconnect
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      if (unsubscribe) unsubscribe();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
