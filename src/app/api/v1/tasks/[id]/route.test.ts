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

vi.mock("@/lib/task-status", () => ({
  isValidTransition: vi.fn(),
}));

vi.mock("@/lib/task-delivery", () => ({
  deliverTaskToAgent: vi.fn(),
  notifyLeadAgent: vi.fn(),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidTransition } from "@/lib/task-status";
import { deliverTaskToAgent, notifyLeadAgent } from "@/lib/task-delivery";
import { PATCH } from "./route";

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
  (isValidTransition as ReturnType<typeof vi.fn>).mockReturnValue(true);
  (deliverTaskToAgent as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    method: "webhook",
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

function makeRequest(
  id: string,
  body: Record<string, unknown>,
  method = "PATCH"
) {
  return new NextRequest(`http://localhost/api/v1/tasks/${id}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer test-key",
    },
    body: JSON.stringify(body),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/tasks/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when task not found", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockReject(selectChain, { message: "not found", code: "PGRST116" });
    mockSupabase.from.mockReturnValueOnce(selectChain);

    const request = makeRequest("nonexistent", { status: "in_progress" });
    const response = await PATCH(request, makeParams("nonexistent"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Task not found");
  });

  it("returns 400 when no fields provided", async () => {
    const request = makeRequest("task-001", {});
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toBe("At least one field is required");
  });

  it("returns 422 for invalid status transition", async () => {
    (isValidTransition as ReturnType<typeof vi.fn>).mockReturnValue(false);

    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "completed",
      project_id: null,
      agent_id: null,
    });
    mockSupabase.from.mockReturnValueOnce(selectChain);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe(
      "Invalid status transition from completed to in_progress"
    );
  });

  it("returns 200 for valid status transition (pending → in_progress)", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "pending",
      project_id: null,
      agent_id: null,
    });

    const updatedTask = {
      id: "task-001",
      title: "Test task",
      status: "in_progress",
      project_id: null,
      agent_id: null,
      priority: "medium",
      description: null,
      result: null,
      updated_at: "2026-03-05T00:00:00.000Z",
    };
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, updatedTask);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.task).toEqual(updatedTask);
  });

  it("returns 409 on race condition", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "pending",
      project_id: null,
      agent_id: null,
    });

    const updateChain = createMockSupabaseClient().chain;
    mockReject(updateChain, { code: "PGRST116", message: "0 rows" });

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Conflict: task status has changed");
  });

  it("auto-delivers when agent_id set on pending task", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "pending",
      project_id: null,
      agent_id: null,
    });

    const updatedTask = {
      id: "task-001",
      title: "Test task",
      status: "pending",
      project_id: null,
      agent_id: "agent-002",
      priority: "medium",
      description: null,
      result: null,
      updated_at: "2026-03-05T00:00:00.000Z",
    };
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, updatedTask);

    // No dependencies
    const depsChain = createMockSupabaseClient().chain;
    mockResolve(depsChain, []);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(depsChain)
      .mockReturnValueOnce(activityChain);

    const request = makeRequest("task-001", { agent_id: "agent-002" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(deliverTaskToAgent).toHaveBeenCalledWith(
      "task-001",
      "agent-002",
      "ws-001"
    );
    expect(json.delivery).toEqual({ success: true, method: "webhook" });
  });

  it("calls notifyLeadAgent on status change with project_id", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "pending",
      project_id: "proj-1",
      agent_id: null,
    });

    const updatedTask = {
      id: "task-001",
      title: "Test task",
      status: "in_progress",
      project_id: "proj-1",
      agent_id: null,
      priority: "medium",
      description: null,
      result: null,
      updated_at: "2026-03-05T00:00:00.000Z",
    };
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, updatedTask);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const request = makeRequest("task-001", { status: "in_progress" });
    await PATCH(request, makeParams("task-001"));

    expect(notifyLeadAgent).toHaveBeenCalledWith(
      "proj-1",
      "task.status_changed",
      {
        task_id: "task-001",
        title: "Test task",
        old_status: "pending",
        new_status: "in_progress",
      }
    );
  });

  it("does not call notifyLeadAgent when no project_id", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "pending",
      project_id: null,
      agent_id: null,
    });

    const updatedTask = {
      id: "task-001",
      title: "Test task",
      status: "in_progress",
      project_id: null,
      agent_id: null,
      priority: "medium",
      description: null,
      result: null,
      updated_at: "2026-03-05T00:00:00.000Z",
    };
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, updatedTask);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const request = makeRequest("task-001", { status: "in_progress" });
    await PATCH(request, makeParams("task-001"));

    expect(notifyLeadAgent).not.toHaveBeenCalled();
  });

  it("does not auto-deliver when task has unresolved dependencies", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "pending",
      project_id: null,
      agent_id: null,
    });

    const updatedTask = {
      id: "task-001",
      title: "Test task",
      status: "pending",
      project_id: null,
      agent_id: "agent-002",
      priority: "medium",
      description: null,
      result: null,
      updated_at: "2026-03-05T00:00:00.000Z",
    };
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, updatedTask);

    // task_dependencies returns an unresolved dependency
    const depsChain = createMockSupabaseClient().chain;
    mockResolve(depsChain, [{ depends_on_task_id: "task-dep-001" }]);

    // Incomplete deps check returns a non-completed task
    const incompleteChain = createMockSupabaseClient().chain;
    mockResolve(incompleteChain, [{ id: "task-dep-001" }]);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(depsChain)
      .mockReturnValueOnce(incompleteChain)
      .mockReturnValueOnce(activityChain);

    const request = makeRequest("task-001", { agent_id: "agent-002" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(deliverTaskToAgent).not.toHaveBeenCalled();
    expect(json.delivery).toBeUndefined();
  });

  it("logs activity with old/new status values", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      id: "task-001",
      status: "pending",
      project_id: null,
      agent_id: null,
    });

    const updatedTask = {
      id: "task-001",
      title: "Test task",
      status: "in_progress",
      project_id: null,
      agent_id: null,
      priority: "medium",
      description: null,
      result: null,
      updated_at: "2026-03-05T00:00:00.000Z",
    };
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, updatedTask);

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain)
      .mockReturnValueOnce(activityChain);

    const request = makeRequest("task-001", { status: "in_progress" });
    await PATCH(request, makeParams("task-001"));

    // The third from() call should be for activity_log
    expect(mockSupabase.from).toHaveBeenCalledWith("activity_log");
    expect(activityChain.insert).toHaveBeenCalledWith({
      workspace_id: "ws-001",
      agent_id: "agent-001",
      action: "task_updated",
      details: {
        task_id: "task-001",
        changes: { old_status: "pending", new_status: "in_progress" },
      },
    });
  });
});
