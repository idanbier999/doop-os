import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  mockResolve,
  mockReject,
} from "@/__tests__/mocks/supabase";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAgent = {
  id: "agent-001",
  workspace_id: "ws-001",
  name: "test-agent",
};

vi.mock("@/lib/api-auth", () => ({
  authenticateAgent: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: (handler: Function) => handler,
}));

import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { GET } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
    mockSupabase.client
  );
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

    const request = new NextRequest(
      "http://localhost/api/v1/projects/proj-001",
      { method: "GET" }
    );

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 403 when agent is not a project member", async () => {
    const membershipChain = createMockSupabaseClient().chain;
    mockReject(membershipChain, { message: "not found", code: "PGRST116" });

    mockSupabase.from.mockReturnValueOnce(membershipChain);

    const request = new NextRequest(
      "http://localhost/api/v1/projects/proj-001",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toBe("Agent is not a member of this project");
  });

  it("returns 404 when project not found", async () => {
    const membershipChain = createMockSupabaseClient().chain;
    mockResolve(membershipChain, { role: "member" });

    const projectChain = createMockSupabaseClient().chain;
    mockReject(projectChain, { message: "not found", code: "PGRST116" });

    mockSupabase.from
      .mockReturnValueOnce(membershipChain)
      .mockReturnValueOnce(projectChain);

    const request = new NextRequest(
      "http://localhost/api/v1/projects/proj-001",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Project not found");
  });

  it("returns full response with project, team, files, agent_role", async () => {
    const membershipChain = createMockSupabaseClient().chain;
    mockResolve(membershipChain, { role: "lead" });

    const projectChain = createMockSupabaseClient().chain;
    mockResolve(projectChain, {
      id: "proj-001",
      name: "Test Project",
      description: "A test project",
      instructions: "Do things",
      orchestration_mode: "collaborative",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });

    const teamChain = createMockSupabaseClient().chain;
    mockResolve(teamChain, [
      {
        role: "lead",
        status: "active",
        agent: {
          id: "agent-001",
          name: "test-agent",
          capabilities: ["code"],
          agent_type: "developer",
          health: "online",
          webhook_url: "https://example.com/hook",
        },
      },
      {
        role: "member",
        status: "active",
        agent: {
          id: "agent-002",
          name: "other-agent",
          capabilities: ["review"],
          agent_type: "reviewer",
          health: "online",
          webhook_url: null,
        },
      },
    ]);

    const filesChain = createMockSupabaseClient().chain;
    mockResolve(filesChain, [
      {
        id: "file-001",
        file_name: "readme.md",
        file_path: "/readme.md",
        mime_type: "text/markdown",
        file_size: 1024,
      },
    ]);

    mockSupabase.from
      .mockReturnValueOnce(membershipChain)
      .mockReturnValueOnce(projectChain)
      .mockReturnValueOnce(teamChain)
      .mockReturnValueOnce(filesChain);

    const request = new NextRequest(
      "http://localhost/api/v1/projects/proj-001",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

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
    const membershipChain = createMockSupabaseClient().chain;
    mockResolve(membershipChain, { role: "member" });

    const projectChain = createMockSupabaseClient().chain;
    mockResolve(projectChain, {
      id: "proj-001",
      name: "Test Project",
      description: null,
      instructions: null,
      orchestration_mode: "collaborative",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });

    const teamChain = createMockSupabaseClient().chain;
    mockResolve(teamChain, []);

    const filesChain = createMockSupabaseClient().chain;
    mockResolve(filesChain, []);

    mockSupabase.from
      .mockReturnValueOnce(membershipChain)
      .mockReturnValueOnce(projectChain)
      .mockReturnValueOnce(teamChain)
      .mockReturnValueOnce(filesChain);

    const request = new NextRequest(
      "http://localhost/api/v1/projects/proj-001",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.files).toEqual([]);
  });

  it("returns team with only self when no other agents", async () => {
    const membershipChain = createMockSupabaseClient().chain;
    mockResolve(membershipChain, { role: "lead" });

    const projectChain = createMockSupabaseClient().chain;
    mockResolve(projectChain, {
      id: "proj-001",
      name: "Solo Project",
      description: null,
      instructions: null,
      orchestration_mode: "solo",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });

    const teamChain = createMockSupabaseClient().chain;
    mockResolve(teamChain, [
      {
        role: "lead",
        status: "active",
        agent: {
          id: "agent-001",
          name: "test-agent",
          capabilities: ["code"],
          agent_type: "developer",
          health: "online",
          webhook_url: null,
        },
      },
    ]);

    const filesChain = createMockSupabaseClient().chain;
    mockResolve(filesChain, []);

    mockSupabase.from
      .mockReturnValueOnce(membershipChain)
      .mockReturnValueOnce(projectChain)
      .mockReturnValueOnce(teamChain)
      .mockReturnValueOnce(filesChain);

    const request = new NextRequest(
      "http://localhost/api/v1/projects/proj-001",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.team).toHaveLength(1);
    expect(json.team[0].agent.id).toBe("agent-001");
  });

  it("verifies has_webhook is boolean (not the URL string)", async () => {
    const membershipChain = createMockSupabaseClient().chain;
    mockResolve(membershipChain, { role: "member" });

    const projectChain = createMockSupabaseClient().chain;
    mockResolve(projectChain, {
      id: "proj-001",
      name: "Test Project",
      description: null,
      instructions: null,
      orchestration_mode: "collaborative",
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      updated_at: "2026-01-02T00:00:00Z",
    });

    const teamChain = createMockSupabaseClient().chain;
    mockResolve(teamChain, [
      {
        role: "member",
        status: "active",
        agent: {
          id: "agent-002",
          name: "webhook-agent",
          capabilities: ["deploy"],
          agent_type: "deployer",
          health: "online",
          webhook_url: "https://example.com/webhook",
        },
      },
    ]);

    const filesChain = createMockSupabaseClient().chain;
    mockResolve(filesChain, []);

    mockSupabase.from
      .mockReturnValueOnce(membershipChain)
      .mockReturnValueOnce(projectChain)
      .mockReturnValueOnce(teamChain)
      .mockReturnValueOnce(filesChain);

    const request = new NextRequest(
      "http://localhost/api/v1/projects/proj-001",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await GET(request, makeParams("proj-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.team[0].agent.has_webhook).toBe(true);
    expect(json.team[0].agent).not.toHaveProperty("webhook_url");
  });
});
