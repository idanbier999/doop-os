"use server";

import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";

export async function testSlackWebhook(workspaceId: string) {
  try {
    const { user, supabase } = await getAuthenticatedSupabase();
    if (!user || !supabase) {
      return { success: false, error: "Not authenticated" };
    }

    // Authorize — confirm user is owner or admin
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

    // Fetch notification settings
    const { data: settings, error: settingsError } = await supabase
      .from("notification_settings")
      .select("slack_enabled, slack_webhook_url")
      .eq("workspace_id", workspaceId)
      .single();

    if (settingsError || !settings) {
      return { success: false, error: "Notification settings not found" };
    }
    if (!settings.slack_enabled) {
      return { success: false, error: "Slack notifications are disabled" };
    }
    if (!settings.slack_webhook_url?.trim()) {
      return { success: false, error: "Webhook URL is empty" };
    }

    // Fetch workspace name for the test message
    const { data: workspace } = await supabase
      .from("workspaces")
      .select("name")
      .eq("id", workspaceId)
      .single();

    const workspaceName = workspace?.name ?? "Unknown workspace";

    // Build Slack Block Kit payload
    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Mangistew Test Notification",
            emoji: true,
          },
        },
        {
          type: "section",
          fields: [
            {
              type: "mrkdwn",
              text: `*Workspace:*\n${workspaceName}`,
            },
            {
              type: "mrkdwn",
              text: `*Timestamp:*\n${new Date().toISOString()}`,
            },
            {
              type: "mrkdwn",
              text: `*Status:*\nThis is a test`,
            },
          ],
        },
        {
          type: "section",
          text: {
            type: "mrkdwn",
            text: "This is a test notification from Mangistew. If you see this message, your Slack webhook is configured correctly.",
          },
        },
      ],
    };

    // Send to Slack
    const response = await fetch(settings.slack_webhook_url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Slack returned ${response.status}: ${body}`,
      };
    }

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
