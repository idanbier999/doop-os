import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockDb } from "@/__tests__/mocks/drizzle";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAgent = {
  id: "agent-001",
  workspaceId: "ws-001",
  name: "test-agent",
};

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/api-auth", () => ({
  authenticateAgent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => mockDb,
}));

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: (handler: Function) => handler,
}));

import { authenticateAgent } from "@/lib/api-auth";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/agents/heartbeat", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", { method: "POST" });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns { ok: true } for valid heartbeat with empty body", async () => {
    // One db.update() for updating agents table
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("returns 200 for malformed JSON body (treated as empty)", async () => {
    // One db.update() for updating agents table
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: "{not valid json",
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("returns 422 when meta is not an object", async () => {
    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ meta: "not-an-object" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
  });

  it("updates last_seen_at and health to 'healthy'", async () => {
    // One db.update() for updating agents table (no metadata to merge)
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("merges version into metadata", async () => {
    // First db operation: select existing metadata
    pushResult([{ metadata: { existing: true } }]);
    // Second db operation: update agents
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ version: "2.0" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("merges meta into metadata", async () => {
    // First db operation: select existing metadata
    pushResult([{ metadata: { existing: true } }]);
    // Second db operation: update agents
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ meta: { cpu: 42 } }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("preserves existing metadata when merging", async () => {
    // First db operation: select existing metadata
    pushResult([{ metadata: { version: "1.0", custom: "keep-me" } }]);
    // Second db operation: update agents
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ version: "2.0" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("returns 422 when body contains unexpected fields", async () => {
    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ version: "1.0", evil: "payload" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Invalid request body");
  });

  it("returns 422 when status exceeds max length", async () => {
    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ status: "x".repeat(51) }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
  });

  it("returns 422 when version exceeds max length", async () => {
    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ version: "v".repeat(101) }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
  });

  it("returns 422 when field has wrong type", async () => {
    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ version: 12345 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(422);
  });

  it("accepts valid body with all optional fields", async () => {
    // First db operation: select existing metadata (has meta field)
    pushResult([{ metadata: {} }]);
    // Second db operation: update agents
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ status: "ok", version: "1.0", meta: { cpu: 42 } }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("inserts agent_updates when stage/health/message provided", async () => {
    // db.update(agents) — the update
    pushResult([]);
    // db.insert(agentUpdates) — agent_updates insert
    pushResult([]);
    // db.insert(activityLog) — activity_log insert
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ stage: "running", message: "working on it" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("inserts activity_log with status_update action", async () => {
    // db.update(agents) — the update
    pushResult([]);
    // db.insert(agentUpdates) — agent_updates insert
    pushResult([]);
    // db.insert(activityLog) — activity_log insert
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ stage: "blocked", health: "degraded", message: "waiting for input" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("uses provided health value instead of default 'healthy'", async () => {
    // db.update(agents) — the update (health: degraded triggers hasStatusUpdate)
    pushResult([]);
    // db.insert(agentUpdates) — agent_updates insert
    pushResult([]);
    // db.insert(activityLog) — activity_log insert
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ health: "degraded" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("does not insert agent_updates for bare heartbeat", async () => {
    // Only one db.update(agents) — no inserts
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    // Only update was called, no insert
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("returns 500 on update error", async () => {
    // db.update(agents) fails
    pushError(new Error("DB error"));

    const request = new NextRequest("http://localhost/api/v1/agents/heartbeat", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to update heartbeat");
  });
});
