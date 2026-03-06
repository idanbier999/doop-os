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

vi.mock("@/lib/task-delivery", () => ({
  deliverTaskToAgent: vi.fn(),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { deliverTaskToAgent } from "@/lib/task-delivery";
import { GET, POST } from "./route";

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

// ---------------------------------------------------------------------------
// POST Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/tasks", () => {
  function makePostRequest(body: Record<string, unknown>) {
    return new NextRequest("http://localhost/api/v1/tasks", {
      method: "POST",
      headers: {
        Authorization: "Bearer test-key",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  }

  function mockSequentialResolves(chain: any, values: unknown[]) {
    let callIndex = 0;
    Object.defineProperty(chain, "then", {
      get() {
        const value = values[callIndex] ?? { data: null, error: null };
        callIndex++;
        return (resolve?: (val: unknown) => void) => resolve ? resolve(value) : Promise.resolve(value);
      },
      configurable: true,
      enumerable: false,
    });
  }

  it("returns 401 when unauthenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const response = await POST(makePostRequest({ title: "test", project_id: "p1" }));
    expect(response.status).toBe(401);
  });

  it("returns 400 when title is missing", async () => {
    const response = await POST(makePostRequest({ project_id: "p1" }));
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe("title is required");
  });

  it("returns 400 when project_id is missing", async () => {
    const response = await POST(makePostRequest({ title: "test" }));
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe("project_id is required");
  });

  it("returns 403 when agent is not a project member", async () => {
    // project_agents check returns null (no membership)
    mockSequentialResolves(mockSupabase.chain, [
      { data: null, error: { message: "not found" } },
    ]);

    const response = await POST(makePostRequest({ title: "test", project_id: "p1" }));
    expect(response.status).toBe(403);
  });

  it("returns 400 when target agent_id is not a project member", async () => {
    mockSequentialResolves(mockSupabase.chain, [
      { data: { id: "pa-1" }, error: null },  // creator is member
      { data: null, error: { message: "not found" } },  // target is NOT member
    ]);

    const response = await POST(makePostRequest({ title: "test", project_id: "p1", agent_id: "agent-002" }));
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe("Target agent is not a member of this project");
  });

  it("returns 400 when depends_on contains invalid IDs", async () => {
    mockSequentialResolves(mockSupabase.chain, [
      { data: { id: "pa-1" }, error: null },  // creator is member
      { data: [{ id: "t-existing" }], error: null },  // only 1 of 2 dep tasks found
    ]);

    const response = await POST(makePostRequest({
      title: "test",
      project_id: "p1",
      depends_on: ["t-existing", "t-missing"],
    }));
    const json = await response.json();
    expect(response.status).toBe(400);
    expect(json.error).toBe("One or more depends_on task IDs are invalid");
  });

  it("creates task with minimal fields and returns 201", async () => {
    const fakeTask = {
      id: "task-new",
      title: "New task",
      description: null,
      status: "pending",
      priority: "medium",
      project_id: "p1",
      created_at: "2026-01-01",
    };

    mockSequentialResolves(mockSupabase.chain, [
      { data: { id: "pa-1" }, error: null },  // creator is member
      { data: fakeTask, error: null },  // task insert
    ]);

    const response = await POST(makePostRequest({ title: "New task", project_id: "p1" }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.task).toEqual(fakeTask);
    expect(json.delivery).toBeUndefined();
  });

  it("creates task with agent_id and auto-delivers", async () => {
    const fakeTask = {
      id: "task-new",
      title: "Assigned task",
      description: null,
      status: "pending",
      priority: "medium",
      project_id: "p1",
      created_at: "2026-01-01",
    };

    mockSequentialResolves(mockSupabase.chain, [
      { data: { id: "pa-1" }, error: null },  // creator is member
      { data: { id: "pa-2" }, error: null },  // target agent is member
      { data: fakeTask, error: null },  // task insert
    ]);

    const mockDelivery = { success: true, method: "webhook", deliveryId: "d-1" };
    (deliverTaskToAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockDelivery);

    const response = await POST(makePostRequest({
      title: "Assigned task",
      project_id: "p1",
      agent_id: "agent-002",
    }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.delivery).toEqual(mockDelivery);
    expect(deliverTaskToAgent).toHaveBeenCalledWith("task-new", "agent-002", "ws-001");
  });

  it("creates task with depends_on and does NOT auto-deliver", async () => {
    const fakeTask = {
      id: "task-new",
      title: "Dep task",
      description: null,
      status: "pending",
      priority: "medium",
      project_id: "p1",
      created_at: "2026-01-01",
    };

    mockSequentialResolves(mockSupabase.chain, [
      { data: { id: "pa-1" }, error: null },  // creator is member
      { data: { id: "pa-2" }, error: null },  // target agent is member
      { data: [{ id: "t-dep" }], error: null },  // dep tasks valid (1 of 1)
      { data: fakeTask, error: null },  // task insert
    ]);

    const response = await POST(makePostRequest({
      title: "Dep task",
      project_id: "p1",
      agent_id: "agent-002",
      depends_on: ["t-dep"],
    }));
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(deliverTaskToAgent).not.toHaveBeenCalled();
  });

  it("returns 500 when task insert fails", async () => {
    mockSequentialResolves(mockSupabase.chain, [
      { data: { id: "pa-1" }, error: null },  // creator is member
      { data: null, error: { message: "insert failed" } },  // task insert fails
    ]);

    const response = await POST(makePostRequest({ title: "test", project_id: "p1" }));
    const json = await response.json();
    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to create task");
  });
});
