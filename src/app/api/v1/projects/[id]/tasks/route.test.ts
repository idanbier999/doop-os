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

const mockContext = { params: Promise.resolve({ id: "proj-001" }) };

beforeEach(() => {
  vi.clearAllMocks();
  reset();
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
    // db.select() for project → empty
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test task" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(404);
  });

  it("returns 403 when agent is not project lead", async () => {
    // db.select() for project → found
    pushResult([{ id: "proj-001" }]);
    // db.select() for membership → member (not lead)
    pushResult([{ role: "member" }]);

    const request = new NextRequest("http://localhost/api/v1/projects/proj-001/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test task" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(403);
  });

  it("returns 201 with task for valid request", async () => {
    // db.select() for project → found
    pushResult([{ id: "proj-001" }]);
    // db.select() for membership → lead
    pushResult([{ role: "lead" }]);
    // db.insert(tasks).returning() → created task
    pushResult([{ id: "task-001", title: "test task", status: "pending" }]);
    // db.insert(activityLog)
    pushResult([]);

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
