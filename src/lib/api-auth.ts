import { NextRequest } from "next/server";
import { getDb } from "@/lib/db/client";
import { agents } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { hashApiKey } from "@/lib/api-key-hash";

export async function authenticateAgent(request: NextRequest) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const apiKey = header.slice(7);
  if (!apiKey) return null;

  const keyHash = hashApiKey(apiKey);

  const db = getDb();
  const result = await db
    .select({
      id: agents.id,
      workspaceId: agents.workspaceId,
      name: agents.name,
    })
    .from(agents)
    .where(eq(agents.apiKeyHash, keyHash))
    .limit(1);

  return result[0] ?? null;
}
