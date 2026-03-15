import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  mockResolve,
  mockReject,
  createTableMocks,
} from "@/__tests__/mocks/supabase";
import { deliverTaskToAgent, notifyLeadAgent } from "@/lib/task-delivery";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToAgent } from "@/lib/webhook-dispatch";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/webhook-dispatch", () => ({
  dispatchToAgent: vi.fn(),
}));

const mockedCreateAdminClient = createAdminClient as ReturnType<typeof vi.fn>;
const mockedDispatchToAgent = dispatchToAgent as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.resetAllMocks();
});

describe("deliverTaskToAgent", () => {
  const taskId = "task-1";
  const agentId = "agent-1";
  const workspaceId = "ws-1";

  function setupMocks() {
    const agentsMock = createMockSupabaseClient();
    const tasksMock = createMockSupabaseClient();
    const mainMock = createMockSupabaseClient();
    createTableMocks(mainMock.from, {
      agents: agentsMock.chain,
      tasks: tasksMock.chain,
    });
    mockedCreateAdminClient.mockReturnValue(mainMock.client);
    return { agentsMock, tasksMock, mainMock };
  }

  it("dispatches via webhook and updates to in_progress for webhook agent", async () => {
    const { agentsMock, tasksMock } = setupMocks();

    mockResolve(agentsMock.chain, { id: agentId, webhook_url: "https://example.com/hook" });
    mockResolve(tasksMock.chain, {
      id: taskId,
      title: "Test task",
      description: "desc",
      priority: "high",
      status: "pending",
      project: { id: "proj-1", name: "P", instructions: null, orchestration_mode: "manual" },
    });

    mockedDispatchToAgent.mockResolvedValue({ success: true, deliveryId: "del-1" });

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: true, method: "webhook", deliveryId: "del-1" });
    expect(mockedDispatchToAgent).toHaveBeenCalledWith(
      agentId,
      expect.objectContaining({ event: "task.assigned" }),
      taskId
    );
    expect(tasksMock.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "in_progress", agent_id: agentId })
    );
  });

  it("returns queue method for polling agent without webhook_url", async () => {
    const { agentsMock, tasksMock } = setupMocks();

    mockResolve(agentsMock.chain, { id: agentId, webhook_url: null });
    mockResolve(tasksMock.chain, {
      id: taskId,
      title: "Test task",
      description: "desc",
      priority: "medium",
      status: "pending",
      project: null,
    });

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: true, method: "queue" });
    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
    expect(tasksMock.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "waiting_on_agent", agent_id: agentId })
    );
  });

  it("returns error when agent is not found", async () => {
    const { agentsMock } = setupMocks();

    mockReject(agentsMock.chain, { message: "not found" });

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: false, method: "queue", error: "Agent not found" });
    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
  });

  it("returns error when dispatch fails and does not update task", async () => {
    const { agentsMock, tasksMock } = setupMocks();

    mockResolve(agentsMock.chain, { id: agentId, webhook_url: "https://example.com/hook" });
    mockResolve(tasksMock.chain, {
      id: taskId,
      title: "Test task",
      description: "desc",
      priority: "high",
      status: "pending",
      project: null,
    });

    mockedDispatchToAgent.mockResolvedValue({ success: false, error: "timeout" });

    const result = await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(result).toEqual({ success: false, method: "webhook", error: "timeout" });
    // Task should NOT be updated to in_progress when dispatch fails
    expect(tasksMock.chain.update).not.toHaveBeenCalled();
  });

  it("uses optimistic lock with .in() on status", async () => {
    const { agentsMock, tasksMock } = setupMocks();

    mockResolve(agentsMock.chain, { id: agentId, webhook_url: "https://example.com/hook" });
    mockResolve(tasksMock.chain, {
      id: taskId,
      title: "Test task",
      description: "desc",
      priority: "high",
      status: "pending",
      project: null,
    });

    mockedDispatchToAgent.mockResolvedValue({ success: true, deliveryId: "del-2" });

    await deliverTaskToAgent(taskId, agentId, workspaceId);

    expect(tasksMock.chain.in).toHaveBeenCalledWith("status", ["pending", "waiting_on_agent"]);
  });
});

describe("notifyLeadAgent", () => {
  function setupMocks() {
    const projectsMock = createMockSupabaseClient();
    const mainMock = createMockSupabaseClient();
    createTableMocks(mainMock.from, {
      projects: projectsMock.chain,
    });
    mockedCreateAdminClient.mockReturnValue(mainMock.client);
    return { projectsMock, mainMock };
  }

  it("dispatches to lead agent when orchestration_mode is lead_agent", async () => {
    const { projectsMock } = setupMocks();

    mockResolve(projectsMock.chain, {
      id: "proj-1",
      lead_agent_id: "lead-1",
      orchestration_mode: "lead_agent",
    });

    mockedDispatchToAgent.mockResolvedValue({ success: true });

    await notifyLeadAgent("proj-1", "task.completed", { taskId: "t-1" });

    expect(mockedDispatchToAgent).toHaveBeenCalledWith(
      "lead-1",
      expect.objectContaining({ event: "task.completed", project_id: "proj-1", taskId: "t-1" })
    );
  });

  it("does nothing when orchestration_mode is manual", async () => {
    const { projectsMock } = setupMocks();

    mockResolve(projectsMock.chain, {
      id: "proj-1",
      lead_agent_id: "lead-1",
      orchestration_mode: "manual",
    });

    await notifyLeadAgent("proj-1", "task.completed", {});

    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
  });

  it("does nothing when lead_agent_id is null", async () => {
    const { projectsMock } = setupMocks();

    mockResolve(projectsMock.chain, {
      id: "proj-1",
      lead_agent_id: null,
      orchestration_mode: "lead_agent",
    });

    await notifyLeadAgent("proj-1", "task.completed", {});

    expect(mockedDispatchToAgent).not.toHaveBeenCalled();
  });

  it("swallows errors silently", async () => {
    const { projectsMock } = setupMocks();

    mockResolve(projectsMock.chain, {
      id: "proj-1",
      lead_agent_id: "lead-1",
      orchestration_mode: "lead_agent",
    });

    mockedDispatchToAgent.mockRejectedValue(new Error("network error"));

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // Should not throw
    await expect(notifyLeadAgent("proj-1", "task.completed", {})).resolves.toBeUndefined();

    warnSpy.mockRestore();
  });
});
