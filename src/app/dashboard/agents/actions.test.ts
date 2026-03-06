import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  mockResolve,
  mockReject,
} from "@/__tests__/mocks/supabase";
import { mockSession } from "@/__tests__/mocks/auth";

// Create a mock client that persists across tests
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server-with-auth", () => ({
  getAuthenticatedSupabase: vi.fn(),
}));

// Import AFTER vi.mock
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { createAgent, reassignAgentOwner } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (getAuthenticatedSupabase as any).mockResolvedValue({
    user: mockSession.user,
    supabase: mockSupabase.client,
    session: mockSession,
  });
});

describe("createAgent", () => {
  const workspaceId = "ws-1";
  const agentName = "Bot";
  const platform = "github";

  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({ success: false, error: "Not authenticated" });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns error when not a workspace member", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockReject(memberChain, { message: "No rows found" });

    mockSupabase.from.mockReturnValueOnce(memberChain);

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({
      success: false,
      error: "Not a member of this workspace",
    });
    expect(mockSupabase.from).toHaveBeenCalledWith("workspace_members");
  });

  it("creates agent and returns agent details", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-1",
      api_key: "ak_test1234",
      name: "Bot",
      platform: "github",
    });

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(activityChain);

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({
      success: true,
      agentId: "a-1",
      apiKey: "ak_test1234",
      apiKeyLast4: "1234",
      name: "Bot",
      platform: "github",
    });
  });

  it("logs agent_registered activity", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-1",
      api_key: "ak_test1234",
      name: "Bot",
      platform: "github",
    });

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(activityChain);

    await createAgent(workspaceId, agentName, platform);

    // Third call to from() should be activity_log
    expect(mockSupabase.from).toHaveBeenNthCalledWith(3, "activity_log");
    expect(activityChain.insert).toHaveBeenCalledWith({
      action: "agent_registered",
      agent_id: "a-1",
      workspace_id: workspaceId,
      details: { name: agentName, platform, owner_id: "user-001" },
    });
  });

  it("returns error on insert failure", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockReject(agentChain, { message: "duplicate key" });

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain);

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({ success: false, error: "duplicate key" });
  });

  it("returns apiKeyLast4 from api_key", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-2",
      api_key: "ak_abcdefghXYZ9",
      name: "Agent2",
      platform: "slack",
    });

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(activityChain);

    const result = await createAgent(workspaceId, "Agent2", "slack");

    expect(result.success).toBe(true);
    expect((result as any).apiKeyLast4).toBe("XYZ9");
    expect((result as any).apiKey).toBe("ak_abcdefghXYZ9");
  });

  it("includes owner_id in agent insert payload", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-1",
      api_key: "ak_test1234",
      name: "Bot",
      platform: "github",
    });

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(activityChain);

    await createAgent(workspaceId, agentName, platform);

    expect(agentChain.insert).toHaveBeenCalledWith({
      workspace_id: workspaceId,
      name: agentName,
      platform,
      health: "offline",
      stage: "idle",
      owner_id: "user-001",
    });
  });

  it("returns agent data after creation with owner_id in insert", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-new",
      api_key: "ak_newkey1234",
      name: "NewBot",
      platform: "slack",
    });

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(activityChain);

    const result = await createAgent("ws-1", "NewBot", "slack");

    // Verify the full data path
    expect(result.success).toBe(true);
    expect((result as any).agentId).toBe("a-new");

    // Verify owner_id was in the insert payload
    expect(agentChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ owner_id: "user-001" })
    );

    // Verify activity log included owner_id
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        details: expect.objectContaining({ owner_id: "user-001" }),
      })
    );
  });
});

describe("reassignAgentOwner", () => {
  const workspaceId = "ws-1";
  const agentId = "agent-1";

  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when not a workspace member", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockReject(memberChain, { message: "No rows found" });
    mockSupabase.from.mockReturnValueOnce(memberChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: false, error: "Not a member of this workspace" });
  });

  it("returns error when agent not found", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "admin" });

    const agentChain = createMockSupabaseClient().chain;
    mockReject(agentChain, { message: "No rows" });

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: false, error: "Agent not found" });
  });

  it("returns error when agent belongs to different workspace", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "admin" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: "user-001", workspace_id: "ws-other" });

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: false, error: "Agent does not belong to this workspace" });
  });

  it("returns error when non-owner member tries to reassign", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: "user-999", workspace_id: workspaceId });

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: false, error: "Only the current owner or an admin can reassign this agent" });
  });

  it("returns error when regular member tries to claim unassigned agent", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: null, workspace_id: workspaceId });

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: false, error: "Only an admin can assign an unassigned agent" });
  });

  it("allows admin to assign unassigned agent", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "admin" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: null, workspace_id: workspaceId });

    const newOwnerChain = createMockSupabaseClient().chain;
    mockResolve(newOwnerChain, { user_id: "user-002" });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(newOwnerChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: true });
  });

  it("allows current owner to reassign", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: "user-001", workspace_id: workspaceId });

    const newOwnerChain = createMockSupabaseClient().chain;
    mockResolve(newOwnerChain, { user_id: "user-002" });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(newOwnerChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: true });
  });

  it("allows workspace admin to reassign any agent", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: "user-999", workspace_id: workspaceId });

    const newOwnerChain = createMockSupabaseClient().chain;
    mockResolve(newOwnerChain, { user_id: "user-002" });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(newOwnerChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: true });
  });

  it("allows setting owner to null (unassign)", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: "user-001", workspace_id: workspaceId });

    // No new owner validation needed when newOwnerId is null
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const result = await reassignAgentOwner(workspaceId, agentId, null);
    expect(result).toEqual({ success: true });
  });

  it("returns error when update fails", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "admin" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: null, workspace_id: workspaceId });

    const newOwnerChain = createMockSupabaseClient().chain;
    mockResolve(newOwnerChain, { user_id: "user-002" });

    const updateChain = createMockSupabaseClient().chain;
    mockReject(updateChain, { message: "update failed" });

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(newOwnerChain)
      .mockReturnValueOnce(updateChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "user-002");
    expect(result).toEqual({ success: false, error: "update failed" });
  });

  it("returns error when new owner is not a workspace member", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "admin" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: null, workspace_id: workspaceId });

    const newOwnerChain = createMockSupabaseClient().chain;
    mockReject(newOwnerChain, { message: "No rows" });

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(newOwnerChain);

    const result = await reassignAgentOwner(workspaceId, agentId, "nonexistent");
    expect(result).toEqual({ success: false, error: "New owner is not a member of this workspace" });
  });

  it("logs activity with correct payload", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "admin" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, { owner_id: "user-old", workspace_id: workspaceId });

    const newOwnerChain = createMockSupabaseClient().chain;
    mockResolve(newOwnerChain, { user_id: "user-002" });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(agentChain)
      .mockReturnValueOnce(newOwnerChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    await reassignAgentOwner(workspaceId, agentId, "user-002");

    expect(mockSupabase.from).toHaveBeenNthCalledWith(5, "activity_log");
    expect(activityChain.insert).toHaveBeenCalledWith({
      action: "agent_owner_reassigned",
      agent_id: agentId,
      workspace_id: workspaceId,
      details: {
        agent_id: agentId,
        previous_owner_id: "user-old",
        new_owner_id: "user-002",
      },
    });
  });
});
