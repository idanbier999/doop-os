"use server";

import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";

export async function createAgent(
  workspaceId: string,
  name: string,
  platform: string
) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Authorize — confirm user is a member of this workspace
    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { success: false, error: "Not a member of this workspace" };
    }

    // Insert new agent
    const { data: agent, error: insertError } = await supabase
      .from("agents")
      .insert({
        workspace_id: workspaceId,
        name,
        platform,
        health: "offline",
        stage: "idle",
        owner_id: user.id,
      })
      .select("id, api_key, name, platform")
      .single();

    if (insertError || !agent) {
      return {
        success: false,
        error: insertError?.message ?? "Failed to create agent",
      };
    }

    const apiKey = agent.api_key!;

    // Log the registration activity
    await supabase.from("activity_log").insert({
      action: "agent_registered",
      agent_id: agent.id,
      workspace_id: workspaceId,
      details: { name, platform, owner_id: user.id },
    });

    return {
      success: true,
      agentId: agent.id,
      apiKey,
      apiKeyLast4: apiKey.slice(-4),
      name: agent.name,
      platform: agent.platform,
    };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function reassignAgentOwner(
  workspaceId: string,
  agentId: string,
  newOwnerId: string | null
) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Check caller's workspace membership and role
    const { data: callerMember, error: callerError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", workspaceId)
      .eq("user_id", user.id)
      .single();

    if (callerError || !callerMember) {
      return { success: false, error: "Not a member of this workspace" };
    }

    const isAdmin = callerMember.role === "admin" || callerMember.role === "owner";

    // Fetch agent's current owner_id and workspace_id
    const { data: agent, error: agentError } = await supabase
      .from("agents")
      .select("owner_id, workspace_id")
      .eq("id", agentId)
      .single();

    if (agentError || !agent) {
      return { success: false, error: "Agent not found" };
    }

    // Verify agent belongs to this workspace
    if (agent.workspace_id !== workspaceId) {
      return { success: false, error: "Agent does not belong to this workspace" };
    }

    // Authorization rules:
    // - Agent has owner → caller must be current owner OR admin/owner
    // - Agent is unassigned (null) → only admin/owner can assign
    if (agent.owner_id !== null) {
      if (agent.owner_id !== user.id && !isAdmin) {
        return { success: false, error: "Only the current owner or an admin can reassign this agent" };
      }
    } else {
      if (!isAdmin) {
        return { success: false, error: "Only an admin can assign an unassigned agent" };
      }
    }

    // If assigning to a new owner, validate they are a workspace member
    if (newOwnerId !== null) {
      const { data: newOwnerMember, error: newOwnerError } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", newOwnerId)
        .single();

      if (newOwnerError || !newOwnerMember) {
        return { success: false, error: "New owner is not a member of this workspace" };
      }
    }

    // Update the agent's owner_id
    const { error: updateError } = await supabase
      .from("agents")
      .update({ owner_id: newOwnerId })
      .eq("id", agentId);

    if (updateError) {
      return { success: false, error: updateError.message };
    }

    // Log the reassignment activity
    await supabase.from("activity_log").insert({
      action: "agent_owner_reassigned",
      agent_id: agentId,
      workspace_id: workspaceId,
      details: {
        agent_id: agentId,
        previous_owner_id: agent.owner_id,
        new_owner_id: newOwnerId,
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
