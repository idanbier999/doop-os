"use server";

import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";

export async function getQuotas(workspaceId: string) {
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

    const { data, error } = await supabase
      .from("agent_quotas")
      .select("*")
      .eq("workspace_id", workspaceId);

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, quotas: data };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function upsertQuota(data: {
  workspaceId: string;
  agentId?: string;
  maxPerMinute: number;
  maxPerHour: number;
}) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    const { data: member, error: memberError } = await supabase
      .from("workspace_members")
      .select("role")
      .eq("workspace_id", data.workspaceId)
      .eq("user_id", user.id)
      .single();

    if (memberError || !member) {
      return { success: false, error: "Not a member of this workspace" };
    }

    if (member.role !== "owner" && member.role !== "admin") {
      return { success: false, error: "Insufficient permissions" };
    }

    const { error: upsertError } = await supabase
      .from("agent_quotas")
      .upsert(
        {
          workspace_id: data.workspaceId,
          agent_id: data.agentId ?? null,
          max_requests_per_minute: data.maxPerMinute,
          max_requests_per_hour: data.maxPerHour,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "workspace_id,agent_id" }
      );

    if (upsertError) {
      return { success: false, error: upsertError.message };
    }

    await supabase.from("activity_log").insert({
      action: "quota.updated",
      workspace_id: data.workspaceId,
      details: {
        agent_id: data.agentId ?? null,
        max_requests_per_minute: data.maxPerMinute,
        max_requests_per_hour: data.maxPerHour,
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

export async function deleteQuota(quotaId: string, workspaceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

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
      return { success: false, error: "Insufficient permissions" };
    }

    const { error: deleteError } = await supabase
      .from("agent_quotas")
      .delete()
      .eq("id", quotaId)
      .eq("workspace_id", workspaceId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    await supabase.from("activity_log").insert({
      action: "quota.deleted",
      workspace_id: workspaceId,
      details: { quota_id: quotaId },
    });

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
