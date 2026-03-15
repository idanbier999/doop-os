import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  createTableMocks,
  mockResolve,
  mockReject,
  MockSupabaseChain,
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
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;
const mockContext = { params: Promise.resolve({ id: "proj-001" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase.client);
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/projects/:id/tasks", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test task" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(400);
  });

  it("returns 422 for missing title", async () => {
    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "no title" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(422);
  });

  it("returns 404 when project does not exist", async () => {
    mockReject(mockSupabase.chain, { message: "not found", code: "PGRST116" });

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test task" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(404);
  });

  it("returns 403 when agent is not project lead", async () => {
    const projectsChain = createMockSupabaseClient().chain;
    mockResolve(projectsChain, { id: "proj-001" });

    const membershipChain = createMockSupabaseClient().chain;
    mockResolve(membershipChain, { role: "member" });

    createTableMocks(mockSupabase.from, {
      projects: projectsChain,
      project_agents: membershipChain,
    });

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test task" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(403);
  });

  it("returns 201 with task for valid request", async () => {
    const projectsChain = createMockSupabaseClient().chain;
    mockResolve(projectsChain, { id: "proj-001" });

    const membershipChain = createMockSupabaseClient().chain;
    mockResolve(membershipChain, { role: "lead" });

    const tasksChain = createMockSupabaseClient().chain;
    mockResolve(tasksChain, { id: "task-001", title: "test task", status: "pending" });

    const activityChain = createMockSupabaseClient().chain;

    createTableMocks(mockSupabase.from, {
      projects: projectsChain,
      project_agents: membershipChain,
      tasks: tasksChain,
      activity_log: activityChain,
    });

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test task", priority: "high" }),
    });

    const response = await POST(request, mockContext);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.task_id).toBe("task-001");
    expect(json.title).toBe("test task");
    expect(json.status).toBe("pending");
  });

  it("returns 422 for invalid priority", async () => {
    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test", priority: "critical" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(422);
  });
});
