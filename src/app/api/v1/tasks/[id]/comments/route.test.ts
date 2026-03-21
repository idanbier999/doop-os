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

describe("POST /api/v1/tasks/:id/comments", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test comment" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad",
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(400);
  });

  it("returns 422 for empty content", async () => {
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(422);
  });

  it("returns 404 when task does not exist", async () => {
    // db.select() for task verification → empty (not found)
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test comment" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(404);
  });

  it("returns 201 with comment_id for valid request", async () => {
    // db.select() for task verification → found
    pushResult([{ id: "task-001" }]);
    // db.insert(taskComments).returning() → comment
    pushResult([{ id: "comment-001" }]);
    // db.insert(activityLog) → activity log
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "This is a test comment" }),
    });

    const response = await POST(request, mockContext);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.comment_id).toBe("comment-001");
    expect(json.task_id).toBe("task-001");
  });

  it("returns 422 for unexpected fields", async () => {
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test", evil: true }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(422);
  });
});
