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
    mockReject(mockSupabase.chain, { message: "not found", code: "PGRST116" });

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/comments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: "test comment" }),
    });

    const response = await POST(request, mockContext);
    expect(response.status).toBe(404);
  });

  it("returns 201 with comment_id for valid request", async () => {
    const tasksChain = createMockSupabaseClient().chain;
    mockResolve(tasksChain, { id: "task-001" });

    const commentsChain = createMockSupabaseClient().chain;
    mockResolve(commentsChain, { id: "comment-001" });

    const activityChain = createMockSupabaseClient().chain;

    createTableMocks(mockSupabase.from, {
      tasks: tasksChain,
      task_comments: commentsChain,
      activity_log: activityChain,
    });

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
