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

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

import { requireAuth } from "@/lib/auth/session";
import { requireWorkspaceMember, requireWorkspaceAdmin } from "@/lib/db/auth";
import { testWebhook, testSlackWebhook } from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  (requireAuth as any).mockResolvedValue(mockUser);
  (requireWorkspaceMember as any).mockResolvedValue({ role: "owner" });
  (requireWorkspaceAdmin as any).mockResolvedValue(undefined);
  mockFetch.mockReset();
});

// ───────────────────── testWebhook ─────────────────────

describe("testWebhook", () => {
  const agentId = "agent-1";
  const workspaceId = "ws-1";

  it("returns error when not authenticated", async () => {
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await testWebhook(agentId, workspaceId);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when not a workspace member", async () => {
    (requireWorkspaceMember as any).mockRejectedValue(new Error("Not a member"));

    const result = await testWebhook(agentId, workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Not a member of this workspace",
    });
  });

  it("returns error when agent has no webhook URL", async () => {
    // 1. db.select(agents) -> agent with no webhook_url
    pushResult([
      {
        webhookUrl: null,
        webhookSecret: "sec",
        workspaceId: workspaceId,
      },
    ]);

    const result = await testWebhook(agentId, workspaceId);
    expect(result).toEqual({
      success: false,
      error: "No webhook URL configured for this agent",
    });
  });

  it("returns success on successful webhook delivery", async () => {
    // 1. db.select(agents)
    pushResult([
      {
        webhookUrl: "https://example.com/hook",
        webhookSecret: "secret123",
        workspaceId: workspaceId,
      },
    ]);

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
          "X-Doop-Signature": expect.any(String),
        }),
      })
    );
  });

  it("returns error with status code on failed delivery", async () => {
    // 1. db.select(agents)
    pushResult([
      {
        webhookUrl: "https://example.com/hook",
        webhookSecret: null,
        workspaceId: workspaceId,
      },
    ]);

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
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when role is not owner/admin", async () => {
    (requireWorkspaceAdmin as any).mockRejectedValue(new Error("Insufficient permissions"));

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Not a member of this workspace",
    });
  });

  it("returns error when Slack is disabled", async () => {
    // 1. db.select(notificationSettings)
    pushResult([
      {
        slackEnabled: false,
        slackWebhookUrl: "https://hooks.slack.com/services/xxx",
      },
    ]);

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Slack notifications are disabled",
    });
  });

  it("returns error when webhook URL is empty", async () => {
    // 1. db.select(notificationSettings)
    pushResult([
      {
        slackEnabled: true,
        slackWebhookUrl: "",
      },
    ]);

    const result = await testSlackWebhook(workspaceId);
    expect(result).toEqual({
      success: false,
      error: "Webhook URL is empty",
    });
  });

  it("returns success on successful Slack delivery", async () => {
    // 1. db.select(notificationSettings)
    pushResult([
      {
        slackEnabled: true,
        slackWebhookUrl: "https://hooks.slack.com/services/T00/B00/xxx",
      },
    ]);
    // 2. db.select(workspaces) -> workspace name
    pushResult([{ name: "My Workspace" }]);

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
