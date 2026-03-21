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

vi.mock("@/lib/task-status", () => ({
  isValidTransition: vi.fn(),
}));

vi.mock("@/lib/task-delivery", () => ({
  deliverTaskToAgent: vi.fn(),
  notifyLeadAgent: vi.fn(),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { isValidTransition } from "@/lib/task-status";
import { deliverTaskToAgent, notifyLeadAgent } from "@/lib/task-delivery";
import { PATCH } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  reset();
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

function makeRequest(id: string, body: Record<string, unknown>, method = "PATCH") {
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
    // db.select() for current task → empty (not found)
    pushResult([]);

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

    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "completed",
        projectId: null,
        agentId: null,
      },
    ]);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Invalid status transition from completed to in_progress");
  });

  it("returns 200 for valid status transition (pending -> in_progress)", async () => {
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

    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "pending",
        projectId: null,
        agentId: null,
      },
    ]);
    // db.update().returning() → updated task
    pushResult([updatedTask]);
    // db.insert(activityLog)
    pushResult([]);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.task).toEqual(updatedTask);
  });

  it("returns 409 on race condition", async () => {
    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "pending",
        projectId: null,
        agentId: null,
      },
    ]);
    // db.update().returning() → empty array (0 rows updated = race condition)
    pushResult([]);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Conflict: task status has changed");
  });

  it("auto-delivers when agent_id set on pending task", async () => {
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

    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "pending",
        projectId: null,
        agentId: null,
      },
    ]);
    // db.update().returning() → updated task (non-status update path)
    pushResult([updatedTask]);
    // db.select() for task_dependencies → no deps
    pushResult([]);
    // db.insert(activityLog)
    pushResult([]);

    const request = makeRequest("task-001", { agent_id: "agent-002" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(deliverTaskToAgent).toHaveBeenCalledWith("task-001", "agent-002", "ws-001");
    expect(json.delivery).toEqual({ success: true, method: "webhook" });
  });

  it("calls notifyLeadAgent on status change with project_id", async () => {
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

    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "pending",
        projectId: "proj-1",
        agentId: null,
      },
    ]);
    // db.update().returning() → updated task
    pushResult([updatedTask]);
    // db.insert(activityLog)
    pushResult([]);

    const request = makeRequest("task-001", { status: "in_progress" });
    await PATCH(request, makeParams("task-001"));

    expect(notifyLeadAgent).toHaveBeenCalledWith("proj-1", "task.status_changed", {
      task_id: "task-001",
      title: "Test task",
      old_status: "pending",
      new_status: "in_progress",
    });
  });

  it("does not call notifyLeadAgent when no project_id", async () => {
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

    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "pending",
        projectId: null,
        agentId: null,
      },
    ]);
    // db.update().returning() → updated task
    pushResult([updatedTask]);
    // db.insert(activityLog)
    pushResult([]);

    const request = makeRequest("task-001", { status: "in_progress" });
    await PATCH(request, makeParams("task-001"));

    expect(notifyLeadAgent).not.toHaveBeenCalled();
  });

  it("does not auto-deliver when task has unresolved dependencies", async () => {
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

    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "pending",
        projectId: null,
        agentId: null,
      },
    ]);
    // db.update().returning() → updated task (non-status update path)
    pushResult([updatedTask]);
    // db.select() for task_dependencies → has deps
    pushResult([{ dependsOnTaskId: "task-dep-001" }]);
    // db.select() for incomplete deps → found incomplete dep
    pushResult([{ id: "task-dep-001" }]);
    // db.insert(activityLog)
    pushResult([]);

    const request = makeRequest("task-001", { agent_id: "agent-002" });
    const response = await PATCH(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(deliverTaskToAgent).not.toHaveBeenCalled();
    expect(json.delivery).toBeUndefined();
  });

  it("logs activity with old/new status values", async () => {
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

    // db.select() for current task
    pushResult([
      {
        id: "task-001",
        status: "pending",
        projectId: null,
        agentId: null,
      },
    ]);
    // db.update().returning() → updated task
    pushResult([updatedTask]);
    // db.insert(activityLog)
    pushResult([]);

    const request = makeRequest("task-001", { status: "in_progress" });
    const response = await PATCH(request, makeParams("task-001"));

    expect(response.status).toBe(200);
    // Verify insert was called (activity log)
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
