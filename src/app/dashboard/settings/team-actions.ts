"use server";

import crypto from "crypto";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// ─── Action 1: Create Invite Link ───────────────────────────────────────────

export async function createInviteLink(
  workspaceId: string,
  role: "admin" | "member"
) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Check caller is owner or admin
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (member.role !== "owner" && member.role !== "admin") {
      return { success: false, error: "Only owners and admins can create invites" };
    }

    // Only owner can create admin invites
    if (role === "admin" && member.role !== "owner") {
      return { success: false, error: "Only owners can create admin invites" };
    }

    const token = crypto.randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { error: insertError } = await supabase
      .from("workspace_invitations")
      .insert({
        workspace_id: workspaceId,
        created_by: user.id,
        role,
        token,
        expires_at: expiresAt,
      });

    if (insertError) {
      return { success: false, error: insertError.message };
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "invite_created",
      workspace_id: workspaceId,
      user_id: user.id,
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

// ─── Action 2: Get Pending Invitations ──────────────────────────────────────

export async function getPendingInvitations(workspaceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Check caller is owner or admin
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (member.role !== "owner" && member.role !== "admin") {
      return { success: false, error: "Only owners and admins can view invitations" };
    }

    const { data: invitations, error: queryError } = await supabase
      .from("workspace_invitations")
      .select("id, role, created_at, expires_at")
      .eq("workspace_id", workspaceId)
      .is("accepted_at", null)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("created_at", { ascending: false });

    if (queryError) {
      return { success: false, error: queryError.message };
    }

    return { success: true, invitations: invitations ?? [] };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Action 3: Revoke Invitation ────────────────────────────────────────────

export async function revokeInvitation(
  invitationId: string,
  workspaceId: string
) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Check caller is owner or admin
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (member.role !== "owner" && member.role !== "admin") {
      return { success: false, error: "Only owners and admins can revoke invitations" };
    }

    const { data: updated, error: updateError } = await supabase
      .from("workspace_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("workspace_id", workspaceId)
      .is("revoked_at", null)
      .is("accepted_at", null)
      .select("id")
      .single();

    if (updateError || !updated) {
      return { success: false, error: "Invitation not found or already revoked" };
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "invite_revoked",
      workspace_id: workspaceId,
      user_id: user.id,
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

// ─── Action 4: Get Invite Details (Public) ──────────────────────────────────

export async function getInviteDetails(token: string) {
  try {
    const adminClient = createAdminClient();

    const { data: invitation, error: queryError } = await adminClient
      .from("workspace_invitations")
      .select("workspace_id, role, expires_at, accepted_at, revoked_at")
      .eq("token", token)
      .single();

    if (queryError || !invitation) {
      return { success: false, error: "Invalid invitation link" };
    }

    if (invitation.accepted_at) {
      return { success: false, error: "This invitation has already been used" };
    }

    if (invitation.revoked_at) {
      return { success: false, error: "This invitation has been revoked" };
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      return { success: false, error: "This invitation has expired" };
    }

    // Get workspace name
    const { data: workspace } = await adminClient
      .from("workspaces")
      .select("name")
      .eq("id", invitation.workspace_id)
      .single();

    return {
      success: true,
      invitation: {
        workspaceId: invitation.workspace_id,
        workspaceName: workspace?.name ?? "Unknown workspace",
        role: invitation.role,
        expiresAt: invitation.expires_at,
      },
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Action 5: Accept Invitation ────────────────────────────────────────────

export async function acceptInvitation(token: string) {
  try {
    const { user } = await getAuthenticatedSupabase();
    if (!user) {
      return { success: false, error: "Not authenticated" };
    }

    const adminClient = createAdminClient();

    // Validate the token
    const { data: invitation, error: queryError } = await adminClient
      .from("workspace_invitations")
      .select("id, workspace_id, role, expires_at, accepted_at, revoked_at")
      .eq("token", token)
      .single();

    if (queryError || !invitation) {
      return { success: false, error: "Invalid invitation link" };
    }

    if (invitation.accepted_at) {
      return { success: false, error: "This invitation has already been used" };
    }

    if (invitation.revoked_at) {
      return { success: false, error: "This invitation has been revoked" };
    }

    if (new Date(invitation.expires_at) <= new Date()) {
      return { success: false, error: "This invitation has expired" };
    }

    // Check if user is already a member
    const { data: existingMember } = await adminClient
      .from("workspace_members")
      .select("id")
      .eq("workspace_id", invitation.workspace_id)
      .eq("user_id", user.id)
      .single();

    if (existingMember) {
      return { success: false, error: "You are already a member of this workspace" };
    }

    // Atomically mark invitation as accepted (single-use enforcement)
    const { data: accepted, error: updateError } = await adminClient
      .from("workspace_invitations")
      .update({
        accepted_at: new Date().toISOString(),
        accepted_by: user.id,
      })
      .eq("id", invitation.id)
      .is("accepted_at", null)
      .select("id")
      .single();

    if (updateError || !accepted) {
      return { success: false, error: "Invitation has already been used" };
    }

    // Add user to workspace
    const { error: memberError } = await adminClient
      .from("workspace_members")
      .insert({
        workspace_id: invitation.workspace_id,
        user_id: user.id,
        role: invitation.role,
      });

    if (memberError) {
      return { success: false, error: memberError.message };
    }

    // Log activity
    await adminClient.from("activity_log").insert({
      action: "invite_accepted",
      workspace_id: invitation.workspace_id,
      user_id: user.id,
      details: { role: invitation.role },
    });

    return { success: true, workspaceId: invitation.workspace_id };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ─── Action 6: Update Member Role ───────────────────────────────────────────

export async function updateMemberRole(
  workspaceId: string,
  memberId: string,
  newRole: "admin" | "member"
) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Verify caller is owner
    const { data: callerMember, error: callerError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (callerError || !callerMember) {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (callerMember.role !== "owner") {
      return { success: false, error: "Only the workspace owner can change roles" };
    }

    // Get target member
    const { data: targetMember, error: targetError } = await supabase
      .from("workspace_members")
      .select("id, user_id, role")
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .single();

    if (targetError || !targetMember) {
      return { success: false, error: "Member not found" };
    }

    // Can't change own role
    if (targetMember.user_id === user.id) {
      return { success: false, error: "Cannot change your own role" };
    }

    // Can't change owner role
    if (targetMember.role === "owner") {
      return { success: false, error: "Cannot change the owner's role" };
    }

    const { error: updateError } = await supabase
      .from("workspace_members")
      .update({ role: newRole })
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "member_role_changed",
      workspace_id: workspaceId,
      user_id: user.id,
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

// ─── Action 7: Remove Member ────────────────────────────────────────────────

export async function removeMember(workspaceId: string, memberId: string) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Get caller's role
    const { data: callerMember, error: callerError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (callerError || !callerMember) {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (callerMember.role !== "owner" && callerMember.role !== "admin") {
      return { success: false, error: "Only owners and admins can remove members" };
    }

    // Get target member
    const { data: targetMember, error: targetError } = await supabase
      .from("workspace_members")
      .select("id, user_id, role")
      .eq("id", memberId)
      .eq("workspace_id", workspaceId)
      .single();

    if (targetError || !targetMember) {
      return { success: false, error: "Member not found" };
    }

    // Can't remove self
    if (targetMember.user_id === user.id) {
      return { success: false, error: "Cannot remove yourself" };
    }

    // Can't remove owner
    if (targetMember.role === "owner") {
      return { success: false, error: "Cannot remove the workspace owner" };
    }

    // Admins can only remove members, not other admins
    if (callerMember.role === "admin" && targetMember.role === "admin") {
      return { success: false, error: "Admins cannot remove other admins" };
    }

    const { error: deleteError } = await supabase
      .from("workspace_members")
      .delete()
      .eq("id", memberId)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // Log activity
    await supabase.from("activity_log").insert({
      action: "member_removed",
      workspace_id: workspaceId,
      user_id: user.id,
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
