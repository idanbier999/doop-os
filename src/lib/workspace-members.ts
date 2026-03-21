import { getDb } from "@/lib/db/client";
import { workspaceMembers, users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export type MemberInfo = {
  userId: string;
  name: string;
  role: string;
};

export async function getWorkspaceMemberMap(workspaceId: string): Promise<Map<string, MemberInfo>> {
  const db = getDb();
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      userName: users.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const map = new Map<string, MemberInfo>();

  for (const row of rows) {
    map.set(row.userId, {
      userId: row.userId,
      name: row.userName,
      role: row.role,
    });
  }

  return map;
}
