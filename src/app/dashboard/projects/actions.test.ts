import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  mockResolve,
  mockReject,
} from "@/__tests__/mocks/supabase";
import { mockSession } from "@/__tests__/mocks/auth";

// ---------- module-level mocks ----------
let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

vi.mock("@/lib/supabase/server-with-auth", () => ({
  getAuthenticatedSupabase: vi.fn(),
}));

vi.mock("@/lib/webhook-dispatch", () => ({
  dispatchToAgent: vi.fn().mockResolvedValue({ success: true, deliveryId: "d-1" }),
}));

vi.mock("@/lib/task-delivery", () => ({
  deliverTaskToAgent: vi.fn().mockResolvedValue({ success: true, method: "webhook" }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => {
    // Return a mock admin client whose from() returns default chains
    const adminMock = createMockSupabaseClient();
    // project_agents and project_files queries return empty arrays
    mockResolve(adminMock.chain, []);
    return adminMock.client;
  }),
}));

// Import AFTER vi.mock
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { dispatchToAgent } from "@/lib/webhook-dispatch";
import { deliverTaskToAgent } from "@/lib/task-delivery";
import {
  createProject,
  updateProjectStatus,
  launchProject,
  dispatchTaskToAgent,
  createProjectTask,
  addProjectFile,
} from "./actions";

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (getAuthenticatedSupabase as any).mockResolvedValue({
    user: mockSession.user,
    supabase: mockSupabase.client,
    session: mockSession,
  });
  // Reset dispatchToAgent to default success
  (dispatchToAgent as any).mockResolvedValue({ success: true, deliveryId: "d-1" });
  // Reset deliverTaskToAgent to default success
  (deliverTaskToAgent as any).mockResolvedValue({ success: true, method: "webhook" });
});

// ───────────────────── helpers ─────────────────────

function memberChainOk(role = "owner") {
  const c = createMockSupabaseClient().chain;
  mockResolve(c, { role });
  return c;
}

function memberChainFail() {
  const c = createMockSupabaseClient().chain;
  mockReject(c, { message: "No rows" });
  return c;
}

function memberChainNull() {
  const c = createMockSupabaseClient().chain;
  mockResolve(c, null);
  return c;
}

function okChain(data: unknown = null) {
  const c = createMockSupabaseClient().chain;
  mockResolve(c, data);
  return c;
}

function errChain(msg: string) {
  const c = createMockSupabaseClient().chain;
  mockReject(c, { message: msg });
  return c;
}

// ───────────────────── createProject ─────────────────────

describe("createProject", () => {
  const baseData = {
    workspaceId: "ws-1",
    name: "Project X",
    description: "desc",
    instructions: "Do stuff",
    orchestration_mode: "manual" as const,
    agentIds: ["agent-1", "agent-2"],
    leadAgentId: "agent-1",
    status: "draft" as const,
  };

  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await createProject(baseData);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when not a workspace member", async () => {
    mockSupabase.from.mockReturnValueOnce(memberChainNull());

    const result = await createProject(baseData);
    expect(result).toEqual({ success: false, error: "Not a workspace member" });
  });

  it("creates project with agents and logs activity", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. projects insert
    mockSupabase.from.mockReturnValueOnce(okChain({ id: "p-1" }));
    // 3. project_agents insert
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 4. activity_log insert
    const activityChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(activityChain);

    const result = await createProject(baseData);

    expect(result).toEqual({ success: true, projectId: "p-1" });
    expect(mockSupabase.from).toHaveBeenCalledWith("project_agents");
    expect(mockSupabase.from).toHaveBeenCalledWith("activity_log");
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project_created" })
    );
  });

  it('uses "project_launched" action when status is "active"', async () => {
    const activeData = { ...baseData, status: "active" as const };

    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    mockSupabase.from.mockReturnValueOnce(okChain({ id: "p-2" }));
    mockSupabase.from.mockReturnValueOnce(okChain(null)); // project_agents
    const activityChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(activityChain);

    const result = await createProject(activeData);

    expect(result.success).toBe(true);
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "project_launched" })
    );
  });
});

// ───────────────────── updateProjectStatus ─────────────────────

describe("updateProjectStatus", () => {
  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await updateProjectStatus("p-1", "ws-1", "active");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("updates project status and logs activity", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. projects.update
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 3. activity_log
    const activityChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(activityChain);

    const result = await updateProjectStatus("p-1", "ws-1", "completed");

    expect(result).toEqual({ success: true });
    expect(mockSupabase.from).toHaveBeenCalledWith("projects");
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "project_status_changed",
        details: { project_id: "p-1", new_status: "completed" },
      })
    );
  });

  it('sets project_agents to "working" when newStatus="active"', async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. projects.update
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 3. project_agents.update (status -> working)
    const paChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(paChain);
    // 4. activity_log
    mockSupabase.from.mockReturnValueOnce(okChain(null));

    const result = await updateProjectStatus("p-1", "ws-1", "active");

    expect(result).toEqual({ success: true });
    expect(mockSupabase.from).toHaveBeenCalledWith("project_agents");
    expect(paChain.update).toHaveBeenCalledWith({ status: "working" });
  });

  it('sets project_agents to "idle" when newStatus="paused"', async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. projects.update
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 3. project_agents.update (status -> idle)
    const paChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(paChain);
    // 4. activity_log
    mockSupabase.from.mockReturnValueOnce(okChain(null));

    const result = await updateProjectStatus("p-1", "ws-1", "paused");

    expect(result).toEqual({ success: true });
    expect(paChain.update).toHaveBeenCalledWith({ status: "idle" });
  });
});

// ───────────────────── launchProject ─────────────────────

describe("launchProject", () => {
  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await launchProject("p-1", "ws-1");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("sets project to active and agents to working", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. projects.select (fetch full project)
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        id: "p-1",
        name: "Proj",
        description: "d",
        instructions: "i",
        orchestration_mode: "manual",
        lead_agent_id: null,
      })
    );
    // 3. projects.update (status -> active)
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 4. project_agents.update (status -> working)
    const paChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(paChain);
    // 5. activity_log
    mockSupabase.from.mockReturnValueOnce(okChain(null));

    const result = await launchProject("p-1", "ws-1");

    expect(result).toEqual({ success: true });
    expect(paChain.update).toHaveBeenCalledWith({ status: "working" });
  });

  it("dispatches webhook for lead_agent orchestration mode", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. projects.select
    mockSupabase.from.mockReturnValueOnce(
      okChain({
        id: "p-1",
        name: "Proj",
        description: "d",
        instructions: "i",
        orchestration_mode: "lead_agent",
        lead_agent_id: "agent-lead",
      })
    );
    // 3. projects.update
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 4. project_agents.update
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 5. activity_log
    mockSupabase.from.mockReturnValueOnce(okChain(null));

    const result = await launchProject("p-1", "ws-1");

    expect(result).toEqual({ success: true });
    expect(dispatchToAgent).toHaveBeenCalledWith(
      "agent-lead",
      expect.objectContaining({ event: "project.launched" })
    );
  });

  it("returns error when project not found", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. projects.select (not found)
    mockSupabase.from.mockReturnValueOnce(errChain("Not found"));

    const result = await launchProject("p-999", "ws-1");

    expect(result).toEqual({ success: false, error: "Project not found" });
  });
});

// ───────────────────── dispatchTaskToAgent ─────────────────────

describe("dispatchTaskToAgent", () => {
  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await dispatchTaskToAgent("t-1", "ws-1");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when task has no assigned agent", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. tasks.select (no agent_id)
    mockSupabase.from.mockReturnValueOnce(
      okChain({ id: "t-1", title: "Do thing", agent_id: null })
    );

    const result = await dispatchTaskToAgent("t-1", "ws-1");

    expect(result).toEqual({ success: false, error: "Task has no assigned agent" });
  });

  it("dispatches webhook and logs activity on success", async () => {
    (deliverTaskToAgent as any).mockResolvedValue({ success: true, method: "webhook" });

    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. tasks.select
    mockSupabase.from.mockReturnValueOnce(
      okChain({ id: "t-1", title: "Do thing", agent_id: "agent-1" })
    );
    // 3. activity_log
    const activityChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(activityChain);

    const result = await dispatchTaskToAgent("t-1", "ws-1");

    expect(result).toEqual({ success: true, method: "webhook" });
    expect(deliverTaskToAgent).toHaveBeenCalledWith("t-1", "agent-1", "ws-1");
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "task_dispatched" })
    );
  });

  it("queues task for polling agent", async () => {
    (deliverTaskToAgent as any).mockResolvedValue({ success: true, method: "queue" });

    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. tasks.select
    mockSupabase.from.mockReturnValueOnce(
      okChain({ id: "t-1", title: "Do thing", agent_id: "agent-1" })
    );
    // 3. activity_log
    const activityChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(activityChain);

    const result = await dispatchTaskToAgent("t-1", "ws-1");

    expect(result).toEqual({ success: true, method: "queue" });
    expect(deliverTaskToAgent).toHaveBeenCalledWith("t-1", "agent-1", "ws-1");
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({ action: "task_queued" })
    );
  });

  it("returns error on dispatch failure", async () => {
    (deliverTaskToAgent as any).mockResolvedValue({ success: false, method: "webhook", error: "Connection refused" });

    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. tasks.select
    mockSupabase.from.mockReturnValueOnce(
      okChain({ id: "t-1", title: "Do thing", agent_id: "agent-1" })
    );

    const result = await dispatchTaskToAgent("t-1", "ws-1");

    expect(result).toEqual({ success: false, error: "Connection refused" });
  });
});

// ───────────────────── createProjectTask ─────────────────────

describe("createProjectTask", () => {
  const baseData = {
    projectId: "p-1",
    workspaceId: "ws-1",
    title: "New Task",
    description: "A task",
    priority: "high",
    assignedAgentId: "agent-1",
    dependsOnTaskIds: ["dep-1", "dep-2"],
  };

  it("creates task with dependencies", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. tasks.insert
    mockSupabase.from.mockReturnValueOnce(okChain({ id: "t-new" }));
    // 3. task_agents.insert
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 4. task_dependencies.insert
    const depChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(depChain);
    // 5. activity_log
    mockSupabase.from.mockReturnValueOnce(okChain(null));

    const result = await createProjectTask(baseData);

    expect(result).toEqual({ success: true, taskId: "t-new" });
    expect(mockSupabase.from).toHaveBeenCalledWith("task_dependencies");
    expect(depChain.insert).toHaveBeenCalledWith([
      { task_id: "t-new", depends_on_task_id: "dep-1" },
      { task_id: "t-new", depends_on_task_id: "dep-2" },
    ]);
  });

  it("inserts task_agents when assignedAgentId provided", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. tasks.insert
    mockSupabase.from.mockReturnValueOnce(okChain({ id: "t-new" }));
    // 3. task_agents.insert
    const taChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(taChain);
    // 4. task_dependencies (no deps in this case — but we pass deps to trigger)
    // Actually, let's test with no deps
    // 5. activity_log
    mockSupabase.from.mockReturnValueOnce(okChain(null));

    const result = await createProjectTask({
      ...baseData,
      dependsOnTaskIds: [],
    });

    expect(result).toEqual({ success: true, taskId: "t-new" });
    expect(mockSupabase.from).toHaveBeenCalledWith("task_agents");
    expect(taChain.insert).toHaveBeenCalledWith({
      task_id: "t-new",
      agent_id: "agent-1",
      role: "assignee",
    });
  });

  it("logs task_created activity", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. tasks.insert
    mockSupabase.from.mockReturnValueOnce(okChain({ id: "t-new" }));
    // 3. task_agents (no agent)
    // 4. activity_log
    const activityChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(activityChain);

    const result = await createProjectTask({
      ...baseData,
      assignedAgentId: undefined,
      dependsOnTaskIds: [],
    });

    expect(result).toEqual({ success: true, taskId: "t-new" });
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "task_created",
        details: expect.objectContaining({
          task_id: "t-new",
          title: "New Task",
          project_id: "p-1",
        }),
      })
    );
  });
});

// ───────────────────── addProjectFile ─────────────────────

describe("addProjectFile", () => {
  const baseData = {
    projectId: "p-1",
    workspaceId: "ws-1",
    fileName: "readme.md",
    filePath: "/uploads/readme.md",
    fileSize: 1024,
    mimeType: "text/markdown",
  };

  it("returns error when not authenticated", async () => {
    (getAuthenticatedSupabase as any).mockResolvedValue({
      user: null,
      supabase: null,
      session: null,
    });

    const result = await addProjectFile(baseData);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("inserts project file and logs activity", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. project_files.insert
    mockSupabase.from.mockReturnValueOnce(okChain(null));
    // 3. activity_log
    const activityChain = okChain(null);
    mockSupabase.from.mockReturnValueOnce(activityChain);

    const result = await addProjectFile(baseData);

    expect(result).toEqual({ success: true });
    expect(mockSupabase.from).toHaveBeenCalledWith("project_files");
    expect(activityChain.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "file_uploaded",
        details: { project_id: "p-1", file_name: "readme.md" },
      })
    );
  });

  it("returns error on insert failure", async () => {
    // 1. workspace_members
    mockSupabase.from.mockReturnValueOnce(memberChainOk());
    // 2. project_files.insert — error
    mockSupabase.from.mockReturnValueOnce(errChain("Storage limit exceeded"));

    const result = await addProjectFile(baseData);

    expect(result).toEqual({ success: false, error: "Storage limit exceeded" });
  });
});
