"use server";

import { createHmac } from "crypto";
import { requireAuth } from "@/lib/auth/session";
import { requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { agents, notificationSettings, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function testWebhook(agentId: string, workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Authorize -- confirm user is member of workspace
    try {
      await requireWorkspaceMember(user.id, workspaceId);
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    const db = getDb();

    // Fetch agent webhook config
    const [agent] = await db
      .select({
        webhookUrl: agents.webhookUrl,
        webhookSecret: agents.webhookSecret,
        workspaceId: agents.workspaceId,
      })
      .from(agents)
      .where(eq(agents.id, agentId))
      .limit(1);

    if (!agent) {
      return { success: false, error: "Agent not found" };
    }
    if (agent.workspaceId !== workspaceId) {
      return { success: false, error: "Agent does not belong to this workspace" };
    }
    if (!agent.webhookUrl?.trim()) {
      return { success: false, error: "No webhook URL configured for this agent" };
    }

    const payload = {
      event: "test",
      agent_id: agentId,
      timestamp: new Date().toISOString(),
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (agent.webhookSecret) {
      const signature = createHmac("sha256", agent.webhookSecret)
        .update(JSON.stringify(payload))
        .digest("hex");
      headers["X-Doop-Signature"] = signature;
    }

    const response = await fetch(agent.webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text();
      return {
        success: false,
        error: `Webhook returned ${response.status}: ${body}`,
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

export async function testSlackWebhook(workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Authorize -- confirm user is owner or admin
    try {
      await requireWorkspaceAdmin(user.id, workspaceId);
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    const db = getDb();

    // Fetch notification settings
    const [settings] = await db
      .select({
        slackEnabled: notificationSettings.slackEnabled,
        slackWebhookUrl: notificationSettings.slackWebhookUrl,
      })
      .from(notificationSettings)
      .where(eq(notificationSettings.workspaceId, workspaceId))
      .limit(1);

    if (!settings) {
      return { success: false, error: "Notification settings not found" };
    }
    if (!settings.slackEnabled) {
      return { success: false, error: "Slack notifications are disabled" };
    }
    if (!settings.slackWebhookUrl?.trim()) {
      return { success: false, error: "Webhook URL is empty" };
    }

    // Fetch workspace name for the test message
    const [workspace] = await db
      .select({ name: workspaces.name })
      .from(workspaces)
      .where(eq(workspaces.id, workspaceId))
      .limit(1);

    const workspaceName = workspace?.name ?? "Unknown workspace";

    // Build Slack Block Kit payload
    const payload = {
      blocks: [
        {
          type: "header",
          text: {
            type: "plain_text",
            text: "Doop Test Notification",
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
            text: "This is a test notification from Doop. If you see this message, your Slack webhook is configured correctly.",
          },
        },
      ],
    };

    // Send to Slack
    const response = await fetch(settings.slackWebhookUrl, {
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

// ---------------------------------------------------------------------------
// Notification Settings
// ---------------------------------------------------------------------------

export async function getNotificationSettings(workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { settings: null, error: "Not authenticated" };
    }

    try {
      await requireWorkspaceMember(user.id, workspaceId);
    } catch {
      return { settings: null, error: "Not a member of this workspace" };
    }

    const db = getDb();

    const [row] = await db
      .select({
        slackEnabled: notificationSettings.slackEnabled,
        slackWebhookUrl: notificationSettings.slackWebhookUrl,
        notifyOnProblemSeverity: notificationSettings.notifyOnProblemSeverity,
      })
      .from(notificationSettings)
      .where(eq(notificationSettings.workspaceId, workspaceId))
      .limit(1);

    return {
      settings: row ?? {
        slackEnabled: false,
        slackWebhookUrl: null,
        notifyOnProblemSeverity: ["high", "critical"],
      },
    };
  } catch (err) {
    return {
      settings: null,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function saveNotificationSettings(
  workspaceId: string,
  data: {
    slackEnabled: boolean;
    slackWebhookUrl: string | null;
    notifyOnProblemSeverity: string[];
  }
) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { error: "Not authenticated" };
    }

    try {
      await requireWorkspaceAdmin(user.id, workspaceId);
    } catch {
      return { error: "Only admins and owners can update notification settings" };
    }

    const db = getDb();

    // Upsert: try update first, insert if not found
    const [existing] = await db
      .select({ id: notificationSettings.id })
      .from(notificationSettings)
      .where(eq(notificationSettings.workspaceId, workspaceId))
      .limit(1);

    if (existing) {
      await db
        .update(notificationSettings)
        .set({
          slackEnabled: data.slackEnabled,
          slackWebhookUrl: data.slackWebhookUrl,
          notifyOnProblemSeverity: data.notifyOnProblemSeverity,
          updatedAt: new Date(),
        })
        .where(eq(notificationSettings.workspaceId, workspaceId));
    } else {
      await db.insert(notificationSettings).values({
        workspaceId,
        slackEnabled: data.slackEnabled,
        slackWebhookUrl: data.slackWebhookUrl,
        notifyOnProblemSeverity: data.notifyOnProblemSeverity,
      });
    }

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}

// ---------------------------------------------------------------------------
// Workspace Settings
// ---------------------------------------------------------------------------

export async function updateWorkspaceSettings(
  workspaceId: string,
  data: { name: string; slug: string }
) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { error: "Not authenticated" };
    }

    try {
      await requireWorkspaceAdmin(user.id, workspaceId);
    } catch {
      return { error: "Only admins and owners can update workspace settings" };
    }

    if (!data.name.trim()) {
      return { error: "Workspace name is required" };
    }
    if (!data.slug.trim()) {
      return { error: "Workspace slug is required" };
    }

    const db = getDb();

    await db
      .update(workspaces)
      .set({
        name: data.name.trim(),
        slug: data.slug.trim(),
      })
      .where(eq(workspaces.id, workspaceId));

    return {};
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" };
  }
}
