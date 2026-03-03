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
import { getQuotas, upsertQuota, deleteQuota } from "./quota-actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (getAuthenticatedSupabase as any).mockResolvedValue({
    user: mockSession.user,
    supabase: mockSupabase.client,
    session: mockSession,
  });
});

describe("getQuotas", () => {
  const workspaceId = "ws-1";

  it("returns quotas for workspace member", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    const quotasChain = createMockSupabaseClient().chain;
    const quotaData = [
      {
        id: "q-1",
        workspace_id: "ws-1",
        agent_id: null,
        max_requests_per_minute: 60,
        max_requests_per_hour: 1000,
      },
    ];
    mockResolve(quotasChain, quotaData);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(quotasChain);

    const result = await getQuotas(workspaceId);

    expect(result).toEqual({ success: true, quotas: quotaData });
    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, "workspace_members");
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, "agent_quotas");
  });

  it("rejects unauthenticated user", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await getQuotas(workspaceId);

    expect(result).toEqual({ success: false, error: "Not authenticated" });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});

describe("upsertQuota", () => {
  const payload = {
    workspaceId: "ws-1",
    agentId: "agent-1",
    maxPerMinute: 30,
    maxPerHour: 500,
  };

  it("succeeds for admin/owner", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "admin" });

    const upsertChain = createMockSupabaseClient().chain;
    mockResolve(upsertChain, null);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(upsertChain)
      .mockReturnValueOnce(activityChain);

    const result = await upsertQuota(payload);

    expect(result).toEqual({ success: true });
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, "agent_quotas");
    expect(upsertChain.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        workspace_id: "ws-1",
        agent_id: "agent-1",
        max_requests_per_minute: 30,
        max_requests_per_hour: 500,
      }),
      { onConflict: "workspace_id,agent_id" }
    );
    // Activity log
    expect(mockSupabase.from).toHaveBeenNthCalledWith(3, "activity_log");
  });

  it("rejects non-admin member", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "member" });

    mockSupabase.from.mockReturnValueOnce(memberChain);

    const result = await upsertQuota(payload);

    expect(result).toEqual({
      success: false,
      error: "Insufficient permissions",
    });
    // Should only call workspace_members, not agent_quotas
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
  });
});

describe("deleteQuota", () => {
  it("succeeds for admin and logs activity", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { role: "owner" });

    const deleteChain = createMockSupabaseClient().chain;
    mockResolve(deleteChain, null);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(memberChain)
      .mockReturnValueOnce(deleteChain)
      .mockReturnValueOnce(activityChain);

    const result = await deleteQuota("q-1", "ws-1");

    expect(result).toEqual({ success: true });
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, "agent_quotas");
    expect(deleteChain.delete).toHaveBeenCalled();
    // Activity log
    expect(mockSupabase.from).toHaveBeenNthCalledWith(3, "activity_log");
    expect(activityChain.insert).toHaveBeenCalledWith({
      action: "quota.deleted",
      workspace_id: "ws-1",
      details: { quota_id: "q-1" },
    });
  });
});
