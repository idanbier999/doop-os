import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  mockResolve,
  mockReject,
} from "@/__tests__/mocks/supabase";
import { mockSession } from "@/__tests__/mocks/auth";

// ---------- module-level mocks ----------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server-with-auth", () => ({
  getAuthenticatedSupabase: vi.fn(),
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import AFTER vi.mock
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { testWebhook, testSlackWebhook } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (getAuthenticatedSupabase as any).mockResolvedValue({
    user: mockSession.user,
    supabase: mockSupabase.client,
    session: mockSession,
  });
  mockFetch.mockReset();
});

// ───────────────────── helpers ─────────────────────

function memberChainOk(role = "owner") {
  const c = createMockSupabaseClient().chain;
  mockResolve(c, { role });
  return c;
}

function okChain(data: unknown = null) {
  const c = createMockSupabaseClient().chain;
  mockResolve(c, data);
  return c;
}

function errChain(msg: string) {
  const c = createMockSupabaseClient().chain;
  mockReject(c, { message: msg });
  return c;
}

// ───────────────────── testWebhook ─────────────────────

describe("testWebhook", () => {
  const agentId = "agent-1";
  const workspaceId = "ws-1";

  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await testWebhook(agentId, workspaceId);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when not a workspace member", async () => {
    mockSupabase.from.mockReturnValueOnce(errChain("No rows"));

    const result = await testWebhook(agentId, workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Not a member of this workspace",
    });
  });

  it("returns error when agent has no webhook URL", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. agents
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        webhook_url: null,
        webhook_secret: "sec",
        workspace_id: workspaceId,
      })
    );

    const result = await testWebhook(agentId, workspaceId);
    expect(result).toEqual({
      success: false,
      error: "No webhook URL configured for this agent",
    });
  });

  it("returns success on successful webhook delivery", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. agents
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        webhook_url: "https://example.com/hook",
        webhook_secret: "secret123",
        workspace_id: workspaceId,
      })
    );

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const result = await testWebhook(agentId, workspaceId);

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          "X-Tarely-Signature": expect.any(String),
        }),
      })
    );
  });

  it("returns error with status code on failed delivery", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. agents
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        webhook_url: "https://example.com/hook",
        webhook_secret: null,
        workspace_id: workspaceId,
      })
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValue("Internal Server Error"),
    });

    const result = await testWebhook(agentId, workspaceId);

    expect(result.success).toBe(false);
    expect(result.error).toContain("500");
    expect(result.error).toContain("Internal Server Error");
  });
});

// ───────────────────── testSlackWebhook ─────────────────────

describe("testSlackWebhook", () => {
  const workspaceId = "ws-1";

  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when role is not owner/admin", async () => {
    // 1. workspace_members (member role)
    mockSupabase.from.mockReturnValueOnce(memberChainOk("member"));

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Insufficient permissions",
    });
  });

  it("returns error when Slack is disabled", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk("admin"));
    // 2. notification_settings
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        slack_enabled: false,
        slack_webhook_url: "https://hooks.slack.com/services/xxx",
      })
    );

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Slack notifications are disabled",
    });
  });

  it("returns error when webhook URL is empty", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk("owner"));
    // 2. notification_settings
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        slack_enabled: true,
        slack_webhook_url: "",
      })
    );

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Webhook URL is empty",
    });
  });

  it("returns success on successful Slack delivery", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk("owner"));
    // 2. notification_settings
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        slack_enabled: true,
        slack_webhook_url: "https://hooks.slack.com/services/T00/B00/xxx",
      })
    );
    // 3. workspaces (fetch workspace name)
    mockSupabase.from.mockReturnValueOnce(okChain({ name: "My Workspace" }));

    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
    });

    const result = await testSlackWebhook(workspaceId);

    expect(result).toEqual({ success: true });
    expect(mockFetch).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T00/B00/xxx",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );
  });
});
