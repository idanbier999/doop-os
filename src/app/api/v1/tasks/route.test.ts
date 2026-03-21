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
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/tasks", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/v1/tasks", {
      method: "GET",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns tasks with default params (status=pending, limit=20)", async () => {
    const fakeTasks = [
      { id: "t-1", title: "Task 1", status: "pending" },
      { id: "t-2", title: "Task 2", status: "pending" },
    ];
    // One db.select() for the tasks query
    pushResult(fakeTasks);

    const request = new NextRequest("http://localhost/api/v1/tasks", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tasks).toEqual(fakeTasks);
  });

  it("filters by status query param", async () => {
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks?status=completed", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tasks).toEqual([]);
  });

  it("respects limit param (capped at 100)", async () => {
    pushResult([]);

    // Requested 500, should be capped at 100
    const request = new NextRequest("http://localhost/api/v1/tasks?limit=500", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tasks).toEqual([]);
  });

  // Tests the task_agents junction query — resolves to [] so it returns early
  it("filters by assigned_to=me using agent.id", async () => {
    // First db operation: select from taskAgents → empty
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks?assigned_to=me", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tasks).toEqual([]);
  });

  it("supports comma-separated status param", async () => {
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks?status=pending,in_progress", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tasks).toEqual([]);
  });

  it("queries task_agents junction table when assigned_to=me", async () => {
    // First db operation: select from taskAgents → assignments
    pushResult([{ taskId: "t-1", role: "assignee" }]);
    // Second db operation: select from tasks → tasks with those IDs
    pushResult([
      { id: "t-1", title: "Task 1", status: "pending", priority: "high", created_at: "2026-01-01" },
    ]);

    const request = new NextRequest("http://localhost/api/v1/tasks?assigned_to=me", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(json.tasks).toHaveLength(1);
    expect(json.tasks[0].role).toBe("assignee");
  });

  it("returns empty tasks when assigned_to=me and no assignments", async () => {
    // First db operation: select from taskAgents → empty
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks?assigned_to=me", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tasks).toEqual([]);
  });

  it("returns 500 on query error", async () => {
    pushError(new Error("DB error"));

    const request = new NextRequest("http://localhost/api/v1/tasks", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to fetch tasks");
  });
});
