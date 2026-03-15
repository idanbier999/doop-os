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
const mockContext = { params: Promise.resolve({ id: "task-001" }) };

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase.client);
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/tasks/:id/assign", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "00000000-0000-4000-a000-000000000002",
        role: "primary",
      }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(400);
  });

  it("returns 422 for invalid role", async () => {
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "00000000-0000-4000-a000-000000000002",
        role: "owner",
      }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(422);
  });

  it("returns 404 when task does not exist", async () => {
    mockReject(mockSupabase.chain, { message: "not found", code: "PGRST116" });

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "00000000-0000-4000-a000-000000000002",
        role: "primary",
      }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(404);
  });

  it("returns 422 when task has no project", async () => {
    const tasksChain = createMockSupabaseClient().chain;
    mockResolve(tasksChain, { id: "task-001", project_id: null });

    createTableMocks(mockSupabase.from, {
      tasks: tasksChain,
    });

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "00000000-0000-4000-a000-000000000002",
        role: "primary",
      }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(422);
  });

  it("returns 403 when caller is not project lead", async () => {
    const tasksChain = createMockSupabaseClient().chain;
    mockResolve(tasksChain, { id: "task-001", project_id: "proj-001" });

    const callerMembershipChain = createMockSupabaseClient().chain;
    mockResolve(callerMembershipChain, { role: "member" });

    // First from("tasks"), then from("project_agents") for caller check
    mockSupabase.from.mockReturnValueOnce(tasksChain).mockReturnValueOnce(callerMembershipChain);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "00000000-0000-4000-a000-000000000002",
        role: "primary",
      }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(403);
  });

  it("returns 200 for valid assignment (new)", async () => {
    const tasksChain = createMockSupabaseClient().chain;
    mockResolve(tasksChain, { id: "task-001", project_id: "proj-001" });

    const callerMembershipChain = createMockSupabaseClient().chain;
    mockResolve(callerMembershipChain, { role: "lead" });

    const targetMembershipChain = createMockSupabaseClient().chain;
    mockResolve(targetMembershipChain, { agent_id: "00000000-0000-4000-a000-000000000002" });

    const existingChain = createMockSupabaseClient().chain;
    mockResolve(existingChain, null); // No existing assignment

    const insertChain = createMockSupabaseClient().chain;
    const activityChain = createMockSupabaseClient().chain;

    mockSupabase.from
      .mockReturnValueOnce(tasksChain) // tasks
      .mockReturnValueOnce(callerMembershipChain) // project_agents (caller)
      .mockReturnValueOnce(targetMembershipChain) // project_agents (target)
      .mockReturnValueOnce(existingChain) // task_agents (check existing)
      .mockReturnValueOnce(insertChain) // task_agents (insert)
      .mockReturnValueOnce(activityChain); // activity_log

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "00000000-0000-4000-a000-000000000002",
        role: "primary",
      }),
    });

    const response = await POST(request, mockContext);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.task_id).toBe("task-001");
    expect(json.agent_id).toBe("00000000-0000-4000-a000-000000000002");
    expect(json.role).toBe("primary");
  });
});
