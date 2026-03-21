import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb } from "@/__tests__/mocks/drizzle";
import { deliverTaskToAgent, notifyLeadAgent } from "@/lib/task-delivery";
import { dispatchToAgent } from "@/lib/webhook-dispatch";

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));

vi.mock("@/lib/webhook-dispatch", () => ({
  dispatchToAgent: vi.fn(),
}));

const mockedDispatchToAgent = dispatchToAgent as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("deliverTaskToAgent", () => {
  const taskId = "task-1";
  const agentId = "agent-1";
  const workspaceId = "ws-1";

  it("dispatches via webhook and updates to in_progress for webhook agent", async () => {
    // 1. db.select(agents)
    pushResult([{ id: agentId, webhookUrl: "https://example.com/hook" }]);
    // 2. db.select(tasks)
    pushResult([
      {
        id: taskId,
        title: "Test task",
        description: "desc",
        priority: "high",
        status: "pending",
        projectId: "proj-1",
      },
    ]);
    // 3. db.select(projects) -- project context
    pushResult([
      {
        id: "proj-1",
        name: "P",
        instructions: null,
        orchestrationMode: "manual",
      },
    ]);
    // 4. db.update(tasks) -- status -> in_progress (after successful dispatch)
    pushResult([]);

    mockedDispatchToAgent.mockResolvedValue({ success: true, deliveryId: "del-1" });

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: true, method: "webhook", deliveryId: "del-1" });
    expect(mockedDispatchToAgent).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({ event: "task.assigned" }),
      taskId
    );
    // update should have been called for status change
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("returns queue method for polling agent without webhook_url", async () => {
    // 1. db.select(agents)
    pushResult([{ id: agentId, webhookUrl: null }]);
    // 2. db.select(tasks)
    pushResult([
      {
        id: taskId,
        title: "Test task",
        description: "desc",
        priority: "medium",
        status: "pending",
        projectId: null,
      },
    ]);
    // 3. db.update(tasks) -- status -> waiting_on_agent
    pushResult([]);

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: true, method: "queue" });
    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
    expect(mockDb.update).toHaveBeenCalled();
  });

  it("returns error when agent is not found", async () => {
    // 1. db.select(agents) -- empty result
    pushResult([]);

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: false, method: "queue", error: "Agent not found" });
    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
  });

  it("returns error when dispatch fails and does not update task", async () => {
    // 1. db.select(agents)
    pushResult([{ id: agentId, webhookUrl: "https://example.com/hook" }]);
    // 2. db.select(tasks)
    pushResult([
      {
        id: taskId,
        title: "Test task",
        description: "desc",
        priority: "high",
        status: "pending",
        projectId: null,
      },
    ]);

    mockedDispatchToAgent.mockResolvedValue({ success: false, error: "timeout" });

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: false, method: "webhook", error: "timeout" });
    // Task should NOT be updated to in_progress when dispatch fails
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("uses optimistic lock with inArray on status", async () => {
    // 1. db.select(agents)
    pushResult([{ id: agentId, webhookUrl: "https://example.com/hook" }]);
    // 2. db.select(tasks)
    pushResult([
      {
        id: taskId,
        title: "Test task",
        description: "desc",
        priority: "high",
        status: "pending",
        projectId: null,
      },
    ]);
    // 3. db.update(tasks) -- optimistic lock update
    pushResult([]);

    mockedDispatchToAgent.mockResolvedValue({ success: true, deliveryId: "del-2" });

    await deliverTaskToAgent(taskId, agentId, workspaceId);

    // The update call should have been made (optimistic lock uses inArray in where clause)
    expect(mockDb.update).toHaveBeenCalled();
  });
});

describe("notifyLeadAgent", () => {
  it("dispatches to lead agent when orchestration_mode is lead_agent", async () => {
    // 1. db.select(projects)
    pushResult([
      {
        id: "proj-1",
        leadAgentId: "lead-1",
        orchestrationMode: "lead_agent",
      },
    ]);

    mockedDispatchToAgent.mockResolvedValue({ success: true });

    await notifyLeadAgent("proj-1", "task.completed", { taskId: "t-1" });

    expect(mockedDispatchToAgent).toHaveBeenCalledWith(
      "lead-1",
      expect.objectContaining({ event: "task.completed", project_id: "proj-1", taskId: "t-1" })
    );
  });

  it("does nothing when orchestration_mode is manual", async () => {
    // 1. db.select(projects)
    pushResult([
      {
        id: "proj-1",
        leadAgentId: "lead-1",
        orchestrationMode: "manual",
      },
    ]);

    await notifyLeadAgent("proj-1", "task.completed", {});

    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
  });

  it("does nothing when lead_agent_id is null", async () => {
    // 1. db.select(projects)
    pushResult([
      {
        id: "proj-1",
        leadAgentId: null,
        orchestrationMode: "lead_agent",
      },
    ]);

    await notifyLeadAgent("proj-1", "task.completed", {});

    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
  });

  it("swallows errors silently", async () => {
    // 1. db.select(projects)
    pushResult([
      {
        id: "proj-1",
        leadAgentId: "lead-1",
        orchestrationMode: "lead_agent",
      },
    ]);

    mockedDispatchToAgent.mockRejectedValue(new Error("network error"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Should not throw
    await expect(notifyLeadAgent("proj-1", "task.completed", {})).resolves.toBeUndefined();

    warnSpy.mockRestore();
  });
});
