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

vi.mock("@/lib/storage", () => ({
  getStorage: () => ({
    getUrl: (_bucket: string, path: string) => `https://storage.example.com/${path}`,
  }),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { GET } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/projects/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", { method: "GET" });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when agent is not a project member", async () => {
    // db.select() for project_agents membership → empty
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Agent is not a member of this project");
  });

  it("returns 404 when project not found", async () => {
    // db.select() for membership → found
    pushResult([{ role: "member" }]);
    // db.select() for project → empty
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Project not found");
  });

  it("returns full response with project, team, files, agent_role", async () => {
    // db.select() for membership
    pushResult([{ role: "lead" }]);
    // db.select() for project
    pushResult([
      {
        id: "proj-001",
        name: "Test Project",
        description: "A test project",
        instructions: "Do things",
        orchestration_mode: "collaborative",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ]);
    // db.select() for team (join projectAgents + agents)
    pushResult([
      {
        role: "lead",
        status: "active",
        agentId: "agent-001",
        agentName: "test-agent",
        agentCapabilities: ["code"],
        agentType: "developer",
        agentHealth: "online",
        agentWebhookUrl: "https://example.com/hook",
      },
      {
        role: "member",
        status: "active",
        agentId: "agent-002",
        agentName: "other-agent",
        agentCapabilities: ["review"],
        agentType: "reviewer",
        agentHealth: "online",
        agentWebhookUrl: null,
      },
    ]);
    // db.select() for files
    pushResult([
      {
        id: "file-001",
        file_name: "readme.md",
        file_path: "/readme.md",
        mime_type: "text/markdown",
        file_size: 1024,
      },
    ]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.project.id).toBe("proj-001");
    expect(json.project.name).toBe("Test Project");
    expect(json.team).toHaveLength(2);
    expect(json.team[0].role).toBe("lead");
    expect(json.team[0].agent.id).toBe("agent-001");
    expect(json.files).toHaveLength(1);
    expect(json.files[0].file_name).toBe("readme.md");
    expect(json.agent_role).toBe("lead");
  });

  it("returns empty files array when project has no files", async () => {
    // db.select() for membership
    pushResult([{ role: "member" }]);
    // db.select() for project
    pushResult([
      {
        id: "proj-001",
        name: "Test Project",
        description: null,
        instructions: null,
        orchestration_mode: "collaborative",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ]);
    // db.select() for team
    pushResult([]);
    // db.select() for files
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.files).toEqual([]);
  });

  it("returns team with only self when no other agents", async () => {
    // db.select() for membership
    pushResult([{ role: "lead" }]);
    // db.select() for project
    pushResult([
      {
        id: "proj-001",
        name: "Solo Project",
        description: null,
        instructions: null,
        orchestration_mode: "solo",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ]);
    // db.select() for team
    pushResult([
      {
        role: "lead",
        status: "active",
        agentId: "agent-001",
        agentName: "test-agent",
        agentCapabilities: ["code"],
        agentType: "developer",
        agentHealth: "online",
        agentWebhookUrl: null,
      },
    ]);
    // db.select() for files
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.team).toHaveLength(1);
    expect(json.team[0].agent.id).toBe("agent-001");
  });

  it("returns files with url field", async () => {
    // db.select() for membership
    pushResult([{ role: "member" }]);
    // db.select() for project
    pushResult([
      {
        id: "proj-001",
        name: "Test Project",
        description: null,
        instructions: null,
        orchestration_mode: "collaborative",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ]);
    // db.select() for team
    pushResult([]);
    // db.select() for files
    pushResult([
      {
        id: "file-001",
        file_name: "readme.md",
        file_path: "proj-001/readme.md",
        mime_type: "text/markdown",
        file_size: 1024,
      },
    ]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.files).toHaveLength(1);
    expect(json.files[0].url).toBe("https://storage.example.com/proj-001/readme.md");
  });

  it("verifies has_webhook is boolean (not the URL string)", async () => {
    // db.select() for membership
    pushResult([{ role: "member" }]);
    // db.select() for project
    pushResult([
      {
        id: "proj-001",
        name: "Test Project",
        description: null,
        instructions: null,
        orchestration_mode: "collaborative",
        status: "active",
        created_at: "2026-01-01T00:00:00Z",
        updated_at: "2026-01-02T00:00:00Z",
      },
    ]);
    // db.select() for team
    pushResult([
      {
        role: "member",
        status: "active",
        agentId: "agent-002",
        agentName: "webhook-agent",
        agentCapabilities: ["deploy"],
        agentType: "deployer",
        agentHealth: "online",
        agentWebhookUrl: "https://example.com/webhook",
      },
    ]);
    // db.select() for files
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.team[0].agent.has_webhook).toBe(true);
    expect(json.team[0].agent).not.toHaveProperty("webhook_url");
  });
});
