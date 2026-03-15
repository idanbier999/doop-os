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
let problemsChain: MockSupabaseChain;
let tasksChain: MockSupabaseChain;
let activityChain: MockSupabaseChain;

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  problemsChain = createMockSupabaseClient().chain;
  tasksChain = createMockSupabaseClient().chain;
  activityChain = createMockSupabaseClient().chain;
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase.client);
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/problems", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/v1/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/v1/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{not valid",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 422 for missing title", async () => {
    const request = new NextRequest("http://localhost/api/v1/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description: "no title" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it("returns 422 for invalid severity", async () => {
    const request = new NextRequest("http://localhost/api/v1/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test", severity: "mega" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it("returns 201 with problem_id for valid request", async () => {
    mockResolve(problemsChain, { id: "prob-001", severity: "high" });
    createTableMocks(mockSupabase.from, {
      problems: problemsChain,
      activity_log: activityChain,
    });

    const request = new NextRequest("http://localhost/api/v1/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Something broke", severity: "high" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.problem_id).toBe("prob-001");
    expect(json.severity).toBe("high");
  });

  it("returns 404 when task_id does not exist", async () => {
    mockResolve(tasksChain, null);
    // Make .single() return error for not found
    mockReject(tasksChain, { message: "not found", code: "PGRST116" });
    createTableMocks(mockSupabase.from, {
      tasks: tasksChain,
    });

    const request = new NextRequest("http://localhost/api/v1/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Problem with task",
        task_id: "00000000-0000-4000-a000-000000000001",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
  });

  it("returns 422 for unexpected fields", async () => {
    const request = new NextRequest("http://localhost/api/v1/problems", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "test", evil: "payload" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});
