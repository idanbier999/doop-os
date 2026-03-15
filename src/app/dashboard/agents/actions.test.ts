import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient, mockResolve, mockReject } from "@/__tests__/mocks/supabase";
import { mockSession } from "@/__tests__/mocks/auth";

// Create a mock client that persists across tests
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server-with-auth", () => ({
  getAuthenticatedSupabase: vi.fn(),
}));

vi.mock("@/lib/api-key-hash", () => ({
  generateApiKey: vi.fn(() => "doop_abcdef1234567890abcdef12345678"),
  hashApiKey: vi.fn(() => "sha256_hashed_value_here_64chars_padding_xxxxxxxxxxxxxxxxxxxxxx"),
  apiKeyPrefix: vi.fn(() => "doop_abcdef1"),
}));

// Import AFTER vi.mock
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { createAgent } from "./actions";

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
  const workspaceId = "00000000-0000-4000-8000-000000000001";
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

  it("creates agent and returns agent details with generated API key", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-1",
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
      apiKey: "doop_abcdef1234567890abcdef12345678",
      apiKeyPrefix: "doop_abcdef1",
      name: "Bot",
      platform: "github",
    });
  });

  it("inserts api_key_hash and api_key_prefix instead of plaintext key", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-1",
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

    expect(agentChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        api_key_hash: "sha256_hashed_value_here_64chars_padding_xxxxxxxxxxxxxxxxxxxxxx",
        api_key_prefix: "doop_abcdef1",
      })
    );
  });

  it("logs agent_registered activity", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockResolve(agentChain, {
      id: "a-1",
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
      details: { name: agentName, platform },
    });
  });

  it("returns error on insert failure", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const agentChain = createMockSupabaseClient().chain;
    mockReject(agentChain, { message: "duplicate key" });

    mockSupabase.from.mockReturnValueOnce(memberChain).mockReturnValueOnce(agentChain);

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({ success: false, error: "duplicate key" });
  });
});
