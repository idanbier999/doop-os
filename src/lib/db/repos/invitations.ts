import { getDb } from "@/lib/db/client";
import { workspaceInvitations, workspaceMembers } from "@/lib/db/schema";
import type { WorkspaceInvitation, NewWorkspaceInvitation } from "@/lib/db/types";
import { eq, and, isNull, gt } from "drizzle-orm";

/**
 * Create a workspace invitation. Returns the inserted row.
 */
export async function create(data: NewWorkspaceInvitation): Promise<WorkspaceInvitation> {
  const db = getDb();
  const rows = await db.insert(workspaceInvitations).values(data).returning();
  return rows[0];
}

/**
 * Find pending invitations for a workspace.
 * Pending = not accepted, not revoked, not expired.
 */
export async function findPending(workspaceId: string): Promise<WorkspaceInvitation[]> {
  const db = getDb();
  return db
    .select()
    .from(workspaceInvitations)
    .where(
      and(
        eq(workspaceInvitations.workspaceId, workspaceId),
        isNull(workspaceInvitations.acceptedAt),
        isNull(workspaceInvitations.revokedAt),
        gt(workspaceInvitations.expiresAt, new Date())
      )
    );
}

/**
 * Find an invitation by its token.
 */
export async function findByToken(token: string): Promise<WorkspaceInvitation | undefined> {
  const db = getDb();
  const rows = await db
    .select()
    .from(workspaceInvitations)
    .where(eq(workspaceInvitations.token, token))
    .limit(1);
  return rows[0];
}

/**
 * Accept an invitation: mark it as accepted and add the user to the workspace.
 * Runs inside a transaction for consistency.
 */
export async function accept(
  token: string,
  userId: string
): Promise<WorkspaceInvitation | undefined> {
  const db = getDb();

  return db.transaction(async (tx) => {
    // Find and lock the invitation
    const invitations = await tx
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.token, token))
      .limit(1);

    const invitation = invitations[0];
    if (!invitation) return undefined;

    // Mark as accepted
    const [updated] = await tx
      .update(workspaceInvitations)
      .set({
        acceptedAt: new Date(),
        acceptedBy: userId,
      })
      .where(eq(workspaceInvitations.id, invitation.id))
      .returning();

    // Add user to workspace members
    await tx.insert(workspaceMembers).values({
      workspaceId: invitation.workspaceId,
      userId,
      role: invitation.role,
    });

    return updated;
  });
}

/**
 * Revoke an invitation by ID.
 */
export async function revoke(id: string): Promise<WorkspaceInvitation | undefined> {
  const db = getDb();
  const rows = await db
    .update(workspaceInvitations)
    .set({ revokedAt: new Date() })
    .where(eq(workspaceInvitations.id, id))
    .returning();
  return rows[0];
}
