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
    mockResolve(mockSupabase.chain, fakeTasks);

    const request = new NextRequest("http://localhost/api/v1/tasks", {
      method: "GET",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.tasks).toEqual(fakeTasks);

    // Verify default query construction
    expect(mockSupabase.from).toHaveBeenCalledWith("tasks");
    expect(mockSupabase.chain.eq).toHaveBeenCalledWith(
      "workspace_id",
      "ws-001"
    );
    expect(mockSupabase.chain.eq).toHaveBeenCalledWith("status", "pending");
    expect(mockSupabase.chain.limit).toHaveBeenCalledWith(20);
    expect(mockSupabase.chain.order).toHaveBeenCalledWith("created_at", {
      ascending: true,
    });
  });

  it("filters by status query param", async () => {
    mockResolve(mockSupabase.chain, []);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks?status=completed",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    await GET(request);

    expect(mockSupabase.chain.eq).toHaveBeenCalledWith("status", "completed");
  });

  it("respects limit param (capped at 100)", async () => {
    mockResolve(mockSupabase.chain, []);

    // Requested 500, should be capped at 100
    const request = new NextRequest(
      "http://localhost/api/v1/tasks?limit=500",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    await GET(request);

    expect(mockSupabase.chain.limit).toHaveBeenCalledWith(100);
  });

  it("filters by assigned_to=me using agent.id", async () => {
    mockResolve(mockSupabase.chain, []);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks?assigned_to=me",
      {
        method: "GET",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    await GET(request);

    expect(mockSupabase.chain.eq).toHaveBeenCalledWith(
      "agent_id",
      "agent-001"
    );
  });

  it("returns 500 on query error", async () => {
    mockReject(mockSupabase.chain, { message: "DB error" });

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
