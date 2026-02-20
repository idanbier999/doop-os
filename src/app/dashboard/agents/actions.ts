"use server";

import { createClient } from "@/lib/supabase/server";

export async function createAgent(
  workspaceId: string,
  name: string,
  platform: string
) {
  try {
    const supabase = await createClient();

    // Authenticate
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
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
      details: { name, platform },
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
