"use server";

import crypto from "crypto";
import { requireAuth } from "@/lib/auth/session";
import {
  requireWorkspaceMember,
  requireWorkspaceAdmin,
  requireWorkspaceOwner,
} from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import {
  workspaceInvitations,
  workspaceMembers,
  workspaces,
  activityLog,
  users,
} from "@/lib/db/schema";
import { eq, and, isNull, gt, desc } from "drizzle-orm";

// --- Action 1: Create Invite Link ---

export async function createInviteLink(workspaceId: string, role: "admin" | "member") {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Check caller is owner or admin
    let callerRole: string;
    try {
      const result = await requireWorkspaceMember(user.id, workspaceId);
      callerRole = result.role;
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (callerRole !== "owner" && callerRole !== "admin") {
      return { success: false, error: "Only owners and admins can create invites" };
    }

    // Only owner can create admin invites
    if (role === "admin" && callerRole !== "owner") {
      return { success: false, error: "Only owners can create admin invites" };
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const db = getDb();

    await db.insert(workspaceInvitations).values({
      workspaceId,
      createdBy: user.id,
      role,
      token,
      expiresAt,
    });

    // Log activity
    await db.insert(activityLog).values({
      action: "invite_created",
      workspaceId,
      userId: user.id,
      details: { role },
    });

    return { success: true, token };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Action 2: Get Pending Invitations ---

export async function getPendingInvitations(workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Check caller is owner or admin
    let callerRole: string;
    try {
      const result = await requireWorkspaceMember(user.id, workspaceId);
      callerRole = result.role;
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (callerRole !== "owner" && callerRole !== "admin") {
      return { success: false, error: "Only owners and admins can view invitations" };
    }

    const db = getDb();

    const invitations = await db
      .select({
        id: workspaceInvitations.id,
        role: workspaceInvitations.role,
        created_at: workspaceInvitations.createdAt,
        expires_at: workspaceInvitations.expiresAt,
      })
      .from(workspaceInvitations)
      .where(
        and(
          eq(workspaceInvitations.workspaceId, workspaceId),
          isNull(workspaceInvitations.acceptedAt),
          isNull(workspaceInvitations.revokedAt),
          gt(workspaceInvitations.expiresAt, new Date())
        )
      )
      .orderBy(desc(workspaceInvitations.createdAt));

    return { success: true, invitations };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Action 3: Revoke Invitation ---

export async function revokeInvitation(invitationId: string, workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Check caller is owner or admin
    try {
      await requireWorkspaceAdmin(user.id, workspaceId);
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    const db = getDb();

    const updated = await db
      .update(workspaceInvitations)
      .set({ revokedAt: new Date() })
      .where(
        and(
          eq(workspaceInvitations.id, invitationId),
          eq(workspaceInvitations.workspaceId, workspaceId),
          isNull(workspaceInvitations.revokedAt),
          isNull(workspaceInvitations.acceptedAt)
        )
      )
      .returning({ id: workspaceInvitations.id });

    if (updated.length === 0) {
      return { success: false, error: "Invitation not found or already revoked" };
    }

    // Log activity
    await db.insert(activityLog).values({
      action: "invite_revoked",
      workspaceId,
      userId: user.id,
      details: { invitation_id: invitationId },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Action 4: Get Invite Details (Public) ---

export async function getInviteDetails(token: string) {
  try {
    const db = getDb();

    const [invitation] = await db
      .select({
        workspaceId: workspaceInvitations.workspaceId,
        role: workspaceInvitations.role,
        expiresAt: workspaceInvitations.expiresAt,
        acceptedAt: workspaceInvitations.acceptedAt,
        revokedAt: workspaceInvitations.revokedAt,
      })
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.token, token))
      .limit(1);

    if (!invitation) {
      return { success: false, error: "Invalid invitation link" };
    }

    if (invitation.acceptedAt) {
      return { success: false, error: "This invitation has already been used" };
    }

    if (invitation.revokedAt) {
      return { success: false, error: "This invitation has been revoked" };
    }

    if (invitation.expiresAt <= new Date()) {
      return { success: false, error: "This invitation has expired" };
    }

    // Get workspace name
    const [workspace] = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, invitation.workspaceId))
      .limit(1);

    return {
      success: true,
      invitation: {
        workspaceId: invitation.workspaceId,
        workspaceName: workspace?.name ?? "Unknown workspace",
        role: invitation.role,
        expiresAt: invitation.expiresAt.toISOString(),
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Action 5: Accept Invitation ---

export async function acceptInvitation(token: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    const db = getDb();

    // Validate the token
    const [invitation] = await db
      .select()
      .from(workspaceInvitations)
      .where(eq(workspaceInvitations.token, token))
      .limit(1);

    if (!invitation) {
      return { success: false, error: "Invalid invitation link" };
    }

    if (invitation.acceptedAt) {
      return { success: false, error: "This invitation has already been used" };
    }

    if (invitation.revokedAt) {
      return { success: false, error: "This invitation has been revoked" };
    }

    if (invitation.expiresAt <= new Date()) {
      return { success: false, error: "This invitation has expired" };
    }

    // Check if user is already a member
    const [existingMember] = await db
      .select({ id: workspaceMembers.id })
      .from(workspaceMembers)
      .where(
        and(
          eq(workspaceMembers.workspaceId, invitation.workspaceId),
          eq(workspaceMembers.userId, user.id)
        )
      )
      .limit(1);

    if (existingMember) {
      return { success: false, error: "You are already a member of this workspace" };
    }

    // Atomically mark invitation as accepted (single-use enforcement)
    const accepted = await db
      .update(workspaceInvitations)
      .set({
        acceptedAt: new Date(),
        acceptedBy: user.id,
      })
      .where(
        and(eq(workspaceInvitations.id, invitation.id), isNull(workspaceInvitations.acceptedAt))
      )
      .returning({ id: workspaceInvitations.id });

    if (accepted.length === 0) {
      return { success: false, error: "Invitation has already been used" };
    }

    // Add user to workspace
    await db.insert(workspaceMembers).values({
      workspaceId: invitation.workspaceId,
      userId: user.id,
      role: invitation.role,
    });

    // Log activity
    await db.insert(activityLog).values({
      action: "invite_accepted",
      workspaceId: invitation.workspaceId,
      userId: user.id,
      details: { role: invitation.role },
    });

    return { success: true, workspaceId: invitation.workspaceId };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Action 6: Update Member Role ---

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  newRole: "admin" | "member"
) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Verify caller is owner
    try {
      await requireWorkspaceOwner(user.id, workspaceId);
    } catch {
      return { success: false, error: "Only the workspace owner can change roles" };
    }

    const db = getDb();

    // Get target member
    const [targetMember] = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
      .limit(1);

    if (!targetMember) {
      return { success: false, error: "Member not found" };
    }

    // Can't change own role
    if (targetMember.userId === user.id) {
      return { success: false, error: "Cannot change your own role" };
    }

    // Can't change owner role
    if (targetMember.role === "owner") {
      return { success: false, error: "Cannot change the owner's role" };
    }

    await db
      .update(workspaceMembers)
      .set({ role: newRole })
      .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)));

    // Log activity
    await db.insert(activityLog).values({
      action: "member_role_changed",
      workspaceId,
      userId: user.id,
      details: {
        member_id: memberId,
        new_role: newRole,
      },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Action 7: Remove Member ---

export async function removeMember(workspaceId: string, memberId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Get caller's role
    let callerRole: string;
    try {
      const result = await requireWorkspaceMember(user.id, workspaceId);
      callerRole = result.role;
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (callerRole !== "owner" && callerRole !== "admin") {
      return { success: false, error: "Only owners and admins can remove members" };
    }

    const db = getDb();

    // Get target member
    const [targetMember] = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
      })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)))
      .limit(1);

    if (!targetMember) {
      return { success: false, error: "Member not found" };
    }

    // Can't remove self
    if (targetMember.userId === user.id) {
      return { success: false, error: "Cannot remove yourself" };
    }

    // Can't remove owner
    if (targetMember.role === "owner") {
      return { success: false, error: "Cannot remove the workspace owner" };
    }

    // Admins can only remove members, not other admins
    if (callerRole === "admin" && targetMember.role === "admin") {
      return { success: false, error: "Admins cannot remove other admins" };
    }

    await db
      .delete(workspaceMembers)
      .where(and(eq(workspaceMembers.id, memberId), eq(workspaceMembers.workspaceId, workspaceId)));

    // Log activity
    await db.insert(activityLog).values({
      action: "member_removed",
      workspaceId,
      userId: user.id,
      details: { member_id: memberId },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// --- Action 8: Get Team Members ---

export async function getTeamMembers(workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { members: [] };
    }

    try {
      await requireWorkspaceMember(user.id, workspaceId);
    } catch {
      return { members: [] };
    }

    const db = getDb();

    const rows = await db
      .select({
        id: workspaceMembers.id,
        userId: workspaceMembers.userId,
        role: workspaceMembers.role,
        createdAt: workspaceMembers.createdAt,
        name: users.name,
      })
      .from(workspaceMembers)
      .innerJoin(users, eq(workspaceMembers.userId, users.id))
      .where(eq(workspaceMembers.workspaceId, workspaceId));

    const members = rows.map((r) => ({
      id: r.id,
      userId: r.userId,
      role: r.role,
      createdAt: r.createdAt?.toISOString() ?? null,
      name: r.name,
    }));

    return { members };
  } catch (err) {
    return { members: [] };
  }
}
