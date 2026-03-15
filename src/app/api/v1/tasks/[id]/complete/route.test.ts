import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabaseClient, mockResolve, mockReject } from "@/__tests__/mocks/supabase";

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

const mockNotifyLeadAgent = vi.fn();
vi.mock("@/lib/task-delivery", () => ({
  notifyLeadAgent: (...args: unknown[]) => mockNotifyLeadAgent(...args),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase.client);
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
  project_id: "proj-001",
  title: "Test Task",
};

/** Set up from() calls for a successful complete flow (select → update → activity_log insert) */
function setupSuccessChains(taskData = validTask) {
  const selectChain = createMockSupabaseClient().chain;
  mockResolve(selectChain, taskData);

  const updateChain = createMockSupabaseClient().chain;
  mockResolve(updateChain, null);

  const activityChain = createMockSupabaseClient().chain;
  mockResolve(activityChain, null);

  mockSupabase.from
    .mockReturnValueOnce(selectChain)
    .mockReturnValueOnce(updateChain)
    .mockReturnValueOnce(activityChain);

  return { selectChain, updateChain, activityChain };
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
    const selectChain = createMockSupabaseClient().chain;
    mockReject(selectChain, { message: "not found", code: "PGRST116" });

    mockSupabase.from.mockReturnValueOnce(selectChain);

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
    setupSuccessChains();

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
    const { updateChain } = setupSuccessChains();

    const resultPayload = { output: "all done", score: 42 };
    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer test-key",
      },
      body: JSON.stringify({ result: resultPayload }),
    });

    await POST(request, makeParams("task-001"));

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        result: resultPayload,
      })
    );
  });

  it("returns 500 on update error", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, validTask);

    const updateChain = createMockSupabaseClient().chain;
    mockReject(updateChain, { message: "DB error" });

    mockSupabase.from.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to complete task");
  });

  it("updates task with correct fields and optimistic lock", async () => {
    const { updateChain } = setupSuccessChains();

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    await POST(request, makeParams("task-001"));

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        agent_id: "agent-001",
        updated_at: expect.any(String),
      })
    );
    expect(updateChain.eq).toHaveBeenCalledWith("id", "task-001");
    expect(updateChain.eq).toHaveBeenCalledWith("status", "in_progress");
  });

  it("returns 422 when task has terminal status (completed)", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { ...validTask, status: "completed" });

    mockSupabase.from.mockReturnValueOnce(selectChain);

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
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { ...validTask, status: "cancelled" });

    mockSupabase.from.mockReturnValueOnce(selectChain);

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
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { ...validTask, status: "pending" });

    mockSupabase.from.mockReturnValueOnce(selectChain);

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(422);
    expect(json.error).toBe("Cannot complete task with status 'pending'");
  });

  it("returns 409 on race condition (PGRST116)", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, validTask);

    const updateChain = createMockSupabaseClient().chain;
    mockReject(updateChain, { message: "no rows", code: "PGRST116" });

    mockSupabase.from.mockReturnValueOnce(selectChain).mockReturnValueOnce(updateChain);

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
    const { activityChain } = setupSuccessChains();

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    await POST(request, makeParams("task-001"));

    expect(mockSupabase.from).toHaveBeenCalledWith("activity_log");
    expect(activityChain.insert).toHaveBeenCalledWith({
      workspace_id: "ws-001",
      agent_id: "agent-001",
      action: "task_completed",
      details: {
        task_id: "task-001",
        changes: { old_status: "in_progress", new_status: "completed" },
      },
    });
  });

  it("calls notifyLeadAgent when task has project_id", async () => {
    setupSuccessChains();

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
    setupSuccessChains({ ...validTask, project_id: null as unknown as string });

    const request = new NextRequest("http://localhost/api/v1/tasks/task-001/complete", {
      method: "POST",
      headers: { Authorization: "Bearer test-key" },
    });

    await POST(request, makeParams("task-001"));

    expect(mockNotifyLeadAgent).not.toHaveBeenCalled();
  });
});
