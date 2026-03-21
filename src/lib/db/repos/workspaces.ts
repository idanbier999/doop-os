import { getDb } from "@/lib/db/client";
import { workspaces, workspaceMembers, users } from "@/lib/db/schema";
import type { Workspace, WorkspaceMember } from "@/lib/db/types";
import { eq, and } from "drizzle-orm";

export interface MemberInfo {
  userId: string;
  name: string;
  role: string;
}

export interface WorkspaceWithRole {
  workspace: Workspace;
  role: string;
}

/**
 * Get all workspaces a user belongs to, along with their role.
 */
export async function findByUserId(userId: string): Promise<WorkspaceWithRole[]> {
  const db = getDb();
  const rows = await db
    .select({
      workspace: workspaces,
      role: workspaceMembers.role,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId));

  return rows;
}

/**
 * Create a workspace and add the creating user as owner (transactional).
 */
export async function create(name: string, slug: string, userId: string): Promise<Workspace> {
  const db = getDb();

  return db.transaction(async (tx) => {
    const [workspace] = await tx
      .insert(workspaces)
      .values({ name, slug, createdBy: userId })
      .returning();

    await tx.insert(workspaceMembers).values({
      workspaceId: workspace.id,
      userId,
      role: "owner",
    });

    return workspace;
  });
}

/**
 * Add a member to a workspace.
 */
export async function addMember(
  workspaceId: string,
  userId: string,
  role?: string
): Promise<WorkspaceMember> {
  const db = getDb();
  const rows = await db
    .insert(workspaceMembers)
    .values({
      workspaceId,
      userId,
      role: role ?? "member",
    })
    .returning();
  return rows[0];
}

/**
 * Remove a member from a workspace.
 */
export async function removeMember(workspaceId: string, userId: string): Promise<void> {
  const db = getDb();
  await db
    .delete(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

/**
 * Update a member's role in a workspace.
 */
export async function updateMemberRole(
  workspaceId: string,
  userId: string,
  role: string
): Promise<void> {
  const db = getDb();
  await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(eq(workspaceMembers.workspaceId, workspaceId), eq(workspaceMembers.userId, userId)));
}

/**
 * Get a map of all members in a workspace.
 * Returns Map<userId, MemberInfo>.
 */
export async function getMemberMap(workspaceId: string): Promise<Map<string, MemberInfo>> {
  const db = getDb();

  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      name: users.name,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(workspaceMembers.userId, users.id))
    .where(eq(workspaceMembers.workspaceId, workspaceId));

  const map = new Map<string, MemberInfo>();
  for (const row of rows) {
    map.set(row.userId, {
      userId: row.userId,
      name: row.name,
      role: row.role,
    });
  }
  return map;
}
