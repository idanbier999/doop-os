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

const mockContext = { params: Promise.resolve({ id: "task-001" }) };

beforeEach(() => {
  vi.clearAllMocks();
  reset();
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
    // db.select() for task → empty
    pushResult([]);

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
    // db.select() for task → found, but no project
    pushResult([{ id: "task-001", projectId: null }]);

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
    // db.select() for task → found with project
    pushResult([{ id: "task-001", projectId: "proj-001" }]);
    // db.select() for caller membership → member (not lead)
    pushResult([{ role: "member" }]);

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
    // db.select() for task → found with project
    pushResult([{ id: "task-001", projectId: "proj-001" }]);
    // db.select() for caller membership → lead
    pushResult([{ role: "lead" }]);
    // db.select() for target agent membership → found
    pushResult([{ agentId: "00000000-0000-4000-a000-000000000002" }]);
    // db.select() for existing task_agents → empty (new assignment)
    pushResult([]);
    // db.insert(taskAgents) → insert
    pushResult([]);
    // db.insert(activityLog) → activity log
    pushResult([]);

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
