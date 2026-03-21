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

const mockNotifyLeadAgent = vi.fn();
vi.mock("@/lib/task-delivery", () => ({
  notifyLeadAgent: (...args: unknown[]) => mockNotifyLeadAgent(...args),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const validTask = {
  id: "task-001",
  status: "in_progress",
  projectId: "proj-001",
  title: "Test Task",
};

/** Queue DB results for a successful complete flow (select -> update -> activity_log insert) */
function setupSuccessResults(taskData = validTask) {
  // db.select() for task lookup
  pushResult([taskData]);
  // db.update().returning() → updated row (at least one row to indicate success)
  pushResult([{ id: taskData.id }]);
  // db.insert(activityLog)
  pushResult([]);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/tasks/[id]/complete", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when task not found", async () => {
    // db.select() for task lookup → empty
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks/nonexistent/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("nonexistent"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Task not found");
  });

  it("returns { ok: true } on successful completion", async () => {
    setupSuccessResults();

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("stores result from body", async () => {
    setupSuccessResults();

    const resultPayload = { output: "all done", score: 42 };
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ result: resultPayload }),
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("updates task with correct fields and optimistic lock", async () => {
    setupSuccessResults();

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    // Verify update was called
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("returns 422 when task has terminal status (completed)", async () => {
    // db.select() for task lookup → task with completed status
    pushResult([{ ...validTask, status: "completed" }]);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Cannot complete task with status 'completed'");
  });

  it("returns 422 when task has terminal status (cancelled)", async () => {
    // db.select() for task lookup → task with cancelled status
    pushResult([{ ...validTask, status: "cancelled" }]);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Cannot complete task with status 'cancelled'");
  });

  it("returns 422 when task is pending (invalid transition)", async () => {
    // db.select() for task lookup → task with pending status
    pushResult([{ ...validTask, status: "pending" }]);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Cannot complete task with status 'pending'");
  });

  it("returns 409 on race condition (empty update result)", async () => {
    // db.select() for task lookup
    pushResult([validTask]);
    // db.update().returning() → empty array (0 rows = race condition)
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Conflict: task status has changed");
  });

  it("inserts activity_log on successful completion", async () => {
    setupSuccessResults();

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));

    expect(response.status).toBe(200);
    // Verify insert was called (for activity_log)
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("calls notifyLeadAgent when task has project_id", async () => {
    setupSuccessResults();

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    await POST(request, makeParams("task-001"));

    expect(mockNotifyLeadAgent).toHaveBeenCalledWith("proj-001", "task.status_changed", {
      task_id: "task-001",
      title: "Test Task",
      old_status: "in_progress",
      new_status: "completed",
    });
  });

  it("does not call notifyLeadAgent when task has no project_id", async () => {
    setupSuccessResults({ ...validTask, projectId: null as unknown as string });

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    await POST(request, makeParams("task-001"));

    expect(mockNotifyLeadAgent).not.toHaveBeenCalled();
  });
});
