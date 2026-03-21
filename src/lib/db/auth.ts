import { getDb } from "./client";
import { workspaceMembers } from "./schema";
import { eq, and } from "drizzle-orm";

export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AuthorizationError";
  }
}

/**
 * Check if a user is a member of a workspace. Returns the membership role.
 * Throws AuthorizationError if not a member.
 */
export async function requireWorkspaceMember(
  userId: string,
  workspaceId: string
): Promise<{ role: string }> {
  const db = getDb();
  const result = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.userId, userId), eq(workspaceMembers.workspaceId, workspaceId)))
    .limit(1);

  if (!result[0]) {
    throw new AuthorizationError("Not a member of this workspace");
  }

  return { role: result[0].role };
}

/**
 * Require admin or owner role. Throws AuthorizationError otherwise.
 */
export async function requireWorkspaceAdmin(userId: string, workspaceId: string): Promise<void> {
  const { role } = await requireWorkspaceMember(userId, workspaceId);
  if (role !== "admin" && role !== "owner") {
    throw new AuthorizationError("Requires admin or owner role");
  }
}

/**
 * Require owner role. Throws AuthorizationError otherwise.
 */
export async function requireWorkspaceOwner(userId: string, workspaceId: string): Promise<void> {
  const { role } = await requireWorkspaceMember(userId, workspaceId);
  if (role !== "owner") {
    throw new AuthorizationError("Requires owner role");
  }
}

/**
 * Get all workspace IDs a user belongs to.
 */
export async function getUserWorkspaceIds(userId: string): Promise<string[]> {
  const db = getDb();
  const rows = await db
    .select({ workspaceId: workspaceMembers.workspaceId })
    .from(workspaceMembers)
    .where(eq(workspaceMembers.userId, userId));
  return rows.map((r) => r.workspaceId);
}
