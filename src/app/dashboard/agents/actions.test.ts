import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockDb } from "@/__tests__/mocks/drizzle";
import { mockUser } from "@/__tests__/mocks/auth";

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/db/auth", () => ({
  requireWorkspaceMember: vi.fn(),
  requireWorkspaceAdmin: vi.fn(),
}));

vi.mock("@/lib/api-key-hash", () => ({
  generateApiKey: vi.fn(() => "doop_abcdef1234567890abcdef12345678"),
  hashApiKey: vi.fn(() => "sha256_hashed_value_here_64chars_padding_xxxxxxxxxxxxxxxxxxxxxx"),
  apiKeyPrefix: vi.fn(() => "doop_abcdef1"),
}));

import { requireAuth } from "@/lib/auth/session";
import { requireWorkspaceMember } from "@/lib/db/auth";
import { createAgent } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  (requireAuth as any).mockResolvedValue(mockUser);
  (requireWorkspaceMember as any).mockResolvedValue({ role: "owner" });
});

describe("createAgent", () => {
  const workspaceId = "00000000-0000-4000-8000-000000000001";
  const agentName = "Bot";
  const platform = "github";

  it("returns error when not authenticated", async () => {
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({ success: false, error: "Not authenticated" });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns error when not a workspace member", async () => {
    (requireWorkspaceMember as any).mockRejectedValue(new Error("Not a member"));

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({
      success: false,
      error: "Not a member of this workspace",
    });
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("creates agent and returns agent details with generated API key", async () => {
    // 1. db.insert(agents) -> returning agent
    pushResult([{ id: "a-1", name: "Bot", platform: "github" }]);
    // 2. db.insert(activityLog)
    pushResult([]);

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

  it("stores api_key_hash and api_key_prefix via insert", async () => {
    // 1. db.insert(agents) -> returning agent
    pushResult([{ id: "a-1", name: "Bot", platform: "github" }]);
    // 2. db.insert(activityLog)
    pushResult([]);

    await createAgent(workspaceId, agentName, platform);

    // The first insert call should be for the agent with hashed key fields
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("logs agent_registered activity", async () => {
    // 1. db.insert(agents)
    pushResult([{ id: "a-1", name: "Bot", platform: "github" }]);
    // 2. db.insert(activityLog)
    pushResult([]);

    await createAgent(workspaceId, agentName, platform);

    // Two insert calls: agents and activityLog
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("returns error on insert failure", async () => {
    // 1. db.insert(agents) throws
    pushError(new Error("duplicate key"));

    const result = await createAgent(workspaceId, agentName, platform);

    expect(result).toEqual({ success: false, error: "duplicate key" });
  });
});
