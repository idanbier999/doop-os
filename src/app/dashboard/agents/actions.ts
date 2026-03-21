"use server";

import { z } from "zod";
import crypto from "crypto";
import { requireAuth } from "@/lib/auth/session";
import { requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/db/auth";
import { getDb } from "@/lib/db/client";
import { agents, activityLog } from "@/lib/db/schema";
import { eq, and, asc } from "drizzle-orm";
import { generateApiKey, hashApiKey, apiKeyPrefix } from "@/lib/api-key-hash";
import { getWorkspaceMemberMap, type MemberInfo } from "@/lib/workspace-members";

const createAgentSchema = z.object({
  workspaceId: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  platform: z.string().trim().min(1).max(50),
});

export async function createAgent(workspaceId: string, name: string, platform: string) {
  try {
    const parsed = createAgentSchema.safeParse({ workspaceId, name, platform });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    const validatedWorkspaceId = parsed.data.workspaceId;
    const validatedName = parsed.data.name;
    const validatedPlatform = parsed.data.platform;

    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Authorize -- confirm user is a member of this workspace
    try {
      await requireWorkspaceMember(user.id, validatedWorkspaceId);
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    // Generate API key in app code -- only the hash is stored
    const rawApiKey = generateApiKey();
    const keyHash = hashApiKey(rawApiKey);
    const keyPrefix = apiKeyPrefix(rawApiKey);

    const db = getDb();

    // Insert new agent with hashed key
    const [agent] = await db
      .insert(agents)
      .values({
        workspaceId: validatedWorkspaceId,
        name: validatedName,
        platform: validatedPlatform,
        health: "offline",
        stage: "idle",
        apiKeyHash: keyHash,
        apiKeyPrefix: keyPrefix,
      })
      .returning({ id: agents.id, name: agents.name, platform: agents.platform });

    if (!agent) {
      return { success: false, error: "Failed to create agent" };
    }

    // Log the registration activity
    await db.insert(activityLog).values({
      action: "agent_registered",
      agentId: agent.id,
      workspaceId: validatedWorkspaceId,
      details: { name: validatedName, platform: validatedPlatform },
    });

    return {
      success: true,
      agentId: agent.id,
      apiKey: rawApiKey,
      apiKeyPrefix: keyPrefix,
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

const reassignAgentOwnerSchema = z.object({
  workspaceId: z.string().uuid(),
  agentId: z.string().uuid(),
  newOwnerId: z.string().uuid().nullable(),
});

export async function reassignAgentOwner(
  workspaceId: string,
  agentId: string,
  newOwnerId: string | null
) {
  try {
    const parsed = reassignAgentOwnerSchema.safeParse({ workspaceId, agentId, newOwnerId });
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    // Authorize -- must be admin or owner of the workspace
    try {
      await requireWorkspaceAdmin(user.id, parsed.data.workspaceId);
    } catch {
      return { success: false, error: "Insufficient permissions" };
    }

    const db = getDb();

    await db
      .update(agents)
      .set({ ownerId: parsed.data.newOwnerId })
      .where(
        and(eq(agents.id, parsed.data.agentId), eq(agents.workspaceId, parsed.data.workspaceId))
      );

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Get Agents for a workspace
// ---------------------------------------------------------------------------

export async function getAgents(workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false as const, error: "Not authenticated", agents: [] };
    }

    try {
      await requireWorkspaceMember(user.id, workspaceId);
    } catch {
      return { success: false as const, error: "Not a member of this workspace", agents: [] };
    }

    const db = getDb();

    const rows = await db
      .select({
        id: agents.id,
        name: agents.name,
        agentType: agents.agentType,
        health: agents.health,
        stage: agents.stage,
        platform: agents.platform,
        description: agents.description,
        tags: agents.tags,
        capabilities: agents.capabilities,
        webhookUrl: agents.webhookUrl,
        webhookSecret: agents.webhookSecret,
        apiKeyPrefix: agents.apiKeyPrefix,
        ownerId: agents.ownerId,
        lastSeenAt: agents.lastSeenAt,
        metadata: agents.metadata,
        createdAt: agents.createdAt,
        updatedAt: agents.updatedAt,
        workspaceId: agents.workspaceId,
      })
      .from(agents)
      .where(eq(agents.workspaceId, workspaceId))
      .orderBy(asc(agents.name));

    return { success: true as const, agents: rows };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Unknown error",
      agents: [],
    };
  }
}

// ---------------------------------------------------------------------------
// Get workspace members (for use in client components)
// ---------------------------------------------------------------------------

export async function getWorkspaceMembers(workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false as const, error: "Not authenticated", members: [] as MemberInfo[] };
    }

    try {
      await requireWorkspaceMember(user.id, workspaceId);
    } catch {
      return {
        success: false as const,
        error: "Not a member of this workspace",
        members: [] as MemberInfo[],
      };
    }

    const memberMap = await getWorkspaceMemberMap(workspaceId);
    return { success: true as const, members: Array.from(memberMap.values()) };
  } catch (err) {
    return {
      success: false as const,
      error: err instanceof Error ? err.message : "Unknown error",
      members: [] as MemberInfo[],
    };
  }
}

// ---------------------------------------------------------------------------
// Update Agent (tags, capabilities, webhook_url)
// ---------------------------------------------------------------------------

const updateAgentSchema = z.object({
  agentId: z.string().uuid(),
  workspaceId: z.string().uuid(),
  tags: z.array(z.string()).optional(),
  capabilities: z.array(z.string()).optional(),
  webhookUrl: z.string().nullable().optional(),
});

export async function updateAgent(data: {
  agentId: string;
  workspaceId: string;
  tags?: string[];
  capabilities?: string[];
  webhookUrl?: string | null;
}) {
  try {
    const parsed = updateAgentSchema.safeParse(data);
    if (!parsed.success) {
      return { success: false, error: parsed.error.issues[0].message };
    }

    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    try {
      await requireWorkspaceMember(user.id, parsed.data.workspaceId);
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    const db = getDb();
    const updateFields: Record<string, unknown> = { updatedAt: new Date() };

    if (parsed.data.tags !== undefined) updateFields.tags = parsed.data.tags;
    if (parsed.data.capabilities !== undefined)
      updateFields.capabilities = parsed.data.capabilities;
    if (parsed.data.webhookUrl !== undefined) updateFields.webhookUrl = parsed.data.webhookUrl;

    await db
      .update(agents)
      .set(updateFields)
      .where(
        and(eq(agents.id, parsed.data.agentId), eq(agents.workspaceId, parsed.data.workspaceId))
      );

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Generate Webhook Secret
// ---------------------------------------------------------------------------

export async function generateWebhookSecret(agentId: string, workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    try {
      await requireWorkspaceMember(user.id, workspaceId);
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    const newSecret = crypto.randomUUID().replace(/-/g, "");
    const db = getDb();

    await db
      .update(agents)
      .set({ webhookSecret: newSecret, updatedAt: new Date() })
      .where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)));

    return { success: true, secret: newSecret };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

// ---------------------------------------------------------------------------
// Delete Agent
// ---------------------------------------------------------------------------

export async function deleteAgent(agentId: string, workspaceId: string) {
  try {
    let user;
    try {
      user = await requireAuth();
    } catch {
      return { success: false, error: "Not authenticated" };
    }

    try {
      await requireWorkspaceMember(user.id, workspaceId);
    } catch {
      return { success: false, error: "Not a member of this workspace" };
    }

    const db = getDb();

    await db.delete(agents).where(and(eq(agents.id, agentId), eq(agents.workspaceId, workspaceId)));

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
