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
  notifyLeadAgent: vi.fn(),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyLeadAgent } from "@/lib/task-delivery";
import { POST } from "./route";

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
// Helpers
// ---------------------------------------------------------------------------

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/tasks/[id]/complete", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      { method: "POST" }
    );

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns 404 when task not found", async () => {
    // The first from("tasks") call is the select to verify the task exists.
    // Return fetchError to simulate task not found.
    const selectChain = createMockSupabaseClient().chain;
    mockReject(selectChain, { message: "not found", code: "PGRST116" });

    mockSupabase.from.mockReturnValueOnce(selectChain);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/nonexistent/complete",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await POST(request, makeParams("nonexistent"));
    const json = await response.json();

    expect(response.status).toBe(404);
    expect(json.error).toBe("Task not found");
  });

  it("returns { ok: true } on successful completion", async () => {
    // First from() call: select to verify task exists
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { id: "task-001" });

    // Second from() call: update the task
    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({}),
      }
    );

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("stores result from body", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { id: "task-001" });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const resultPayload = { output: "all done", score: 42 };
    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({ result: resultPayload }),
      }
    );

    await POST(request, makeParams("task-001"));

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        result: resultPayload,
      })
    );
  });

  it("returns 500 on update error", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { id: "task-001" });

    const updateChain = createMockSupabaseClient().chain;
    mockReject(updateChain, { message: "DB error" });

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to complete task");
  });

  it("updates task with correct fields (status, agent_id, updated_at)", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { id: "task-001" });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    await POST(request, makeParams("task-001"));

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "completed",
        agent_id: "agent-001",
        updated_at: expect.any(String),
      })
    );
    expect(updateChain.eq).toHaveBeenCalledWith("id", "task-001");
  });

  it("calls notifyLeadAgent with correct args after successful completion", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { id: "task-001", title: "Test task", project_id: "proj-1" });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    await POST(request, makeParams("task-001"));

    expect(notifyLeadAgent).toHaveBeenCalledWith("proj-1", "task.completed", {
      task_id: "task-001",
      title: "Test task",
    });
  });

  it("returns 409 when task is already completed", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { id: "task-001", title: "Test task", project_id: null });

    const updateChain = createMockSupabaseClient().chain;
    mockReject(updateChain, { code: "PGRST116", message: "0 rows" });

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await POST(request, makeParams("task-001"));
    const json = await response.json();

    expect(response.status).toBe(409);
    expect(json.error).toBe("Task is already completed or cancelled");
  });

  it("does not call notifyLeadAgent when task has no project_id", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { id: "task-001", title: "Test task", project_id: null });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/tasks/task-001/complete",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    await POST(request, makeParams("task-001"));

    expect(notifyLeadAgent).not.toHaveBeenCalled();
  });
});
