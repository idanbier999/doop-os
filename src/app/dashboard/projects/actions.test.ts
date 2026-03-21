import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockDb } from "@/__tests__/mocks/drizzle";
import { mockUser } from "@/__tests__/mocks/auth";

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));
vi.mock("@/lib/auth/session", () => ({ requireAuth: vi.fn() }));
vi.mock("@/lib/db/auth", () => ({
  requireWorkspaceMember: vi.fn(),
  requireWorkspaceAdmin: vi.fn(),
}));

vi.mock("@/lib/webhook-dispatch", () => ({
  dispatchToAgent: vi.fn().mockResolvedValue({ success: true, deliveryId: "d-1" }),
}));

import { requireAuth } from "@/lib/auth/session";
import { requireWorkspaceMember } from "@/lib/db/auth";
import { dispatchToAgent } from "@/lib/webhook-dispatch";
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
  reset();
  (requireAuth as any).mockResolvedValue(mockUser);
  (requireWorkspaceMember as any).mockResolvedValue({ role: "owner" });
  (dispatchToAgent as any).mockResolvedValue({ success: true, deliveryId: "d-1" });
});

// ───────────────────── test UUIDs ─────────────────────

const WS_ID = "00000000-0000-4000-8000-000000000001";
const AGENT_1 = "00000000-0000-4000-8000-000000000010";
const AGENT_2 = "00000000-0000-4000-8000-000000000020";
const PROJECT_1 = "00000000-0000-4000-8000-000000000100";

const DEP_1 = "00000000-0000-4000-8000-000000002000";
const DEP_2 = "00000000-0000-4000-8000-000000003000";

// ───────────────────── createProject ─────────────────────

describe("createProject", () => {
  const baseData = {
    workspaceId: WS_ID,
    name: "Project X",
    description: "desc",
    instructions: "Do stuff",
    orchestration_mode: "manual" as const,
    agentIds: [AGENT_1, AGENT_2],
    leadAgentId: AGENT_1,
    status: "draft" as const,
  };

  it("returns error when not authenticated", async () => {
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await createProject(baseData);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when not a workspace member", async () => {
    (requireWorkspaceMember as any).mockRejectedValue(new Error("Not a member"));

    const result = await createProject(baseData);
    expect(result).toEqual({ success: false, error: "Not a workspace member" });
  });

  it("creates project with agents and logs activity", async () => {
    // 1. db.insert(projects) -> returning { id }
    pushResult([{ id: "p-1" }]);
    // 2. db.insert(projectAgents)
    pushResult([]);
    // 3. db.insert(activityLog)
    pushResult([]);

    const result = await createProject(baseData);

    expect(result).toEqual({ success: true, projectId: "p-1" });
    // 3 inserts: projects, projectAgents, activityLog
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
  });

  it('uses "project_launched" action when status is "active"', async () => {
    const activeData = { ...baseData, status: "active" as const };

    // 1. db.insert(projects)
    pushResult([{ id: "p-2" }]);
    // 2. db.insert(projectAgents)
    pushResult([]);
    // 3. db.insert(activityLog)
    pushResult([]);

    const result = await createProject(activeData);

    expect(result.success).toBe(true);
    // The activity log insert is the 3rd insert call
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
  });
});

// ───────────────────── updateProjectStatus ─────────────────────

describe("updateProjectStatus", () => {
  it("returns error when not authenticated", async () => {
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await updateProjectStatus("p-1", "ws-1", "active");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("updates project status and logs activity", async () => {
    // 1. db.update(projects)
    pushResult([]);
    // 2. db.insert(activityLog)
    pushResult([]);

    const result = await updateProjectStatus("p-1", "ws-1", "completed");

    expect(result).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it('sets project_agents to "working" when newStatus="active"', async () => {
    // 1. db.update(projects)
    pushResult([]);
    // 2. db.update(projectAgents) -- status -> working
    pushResult([]);
    // 3. db.insert(activityLog)
    pushResult([]);

    const result = await updateProjectStatus("p-1", "ws-1", "active");

    expect(result).toEqual({ success: true });
    // 2 update calls: projects, projectAgents
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it('sets project_agents to "idle" when newStatus="paused"', async () => {
    // 1. db.update(projects)
    pushResult([]);
    // 2. db.update(projectAgents) -- status -> idle
    pushResult([]);
    // 3. db.insert(activityLog)
    pushResult([]);

    const result = await updateProjectStatus("p-1", "ws-1", "paused");

    expect(result).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });
});

// ───────────────────── launchProject ─────────────────────

describe("launchProject", () => {
  it("returns error when not authenticated", async () => {
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await launchProject("p-1", "ws-1");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("sets project to active and agents to working", async () => {
    // 1. db.select(projects) -- fetch full project
    pushResult([
      {
        id: "p-1",
        name: "Proj",
        description: "d",
        instructions: "i",
        orchestrationMode: "manual",
        leadAgentId: null,
      },
    ]);
    // 2. db.update(projects) -- status -> active
    pushResult([]);
    // 3. db.update(projectAgents) -- status -> working
    pushResult([]);
    // 4. db.insert(activityLog)
    pushResult([]);

    const result = await launchProject("p-1", "ws-1");

    expect(result).toEqual({ success: true });
    expect(mockDb.update).toHaveBeenCalledTimes(2);
  });

  it("dispatches webhook for lead_agent orchestration mode", async () => {
    // 1. db.select(projects)
    pushResult([
      {
        id: "p-1",
        name: "Proj",
        description: "d",
        instructions: "i",
        orchestrationMode: "lead_agent",
        leadAgentId: "agent-lead",
      },
    ]);
    // 2. db.update(projects) -- status -> active
    pushResult([]);
    // 3. db.update(projectAgents) -- status -> working
    pushResult([]);
    // 4. db.insert(activityLog)
    pushResult([]);
    // 5. db.select(projectAgents innerJoin agents) -- team agents
    pushResult([]);
    // 6. db.select(projectFiles) -- files
    pushResult([]);

    const result = await launchProject("p-1", "ws-1");

    expect(result).toEqual({ success: true });
    expect(dispatchToAgent).toHaveBeenCalledWith(
      "agent-lead",
      expect.objectContaining({ event: "project.launched" })
    );
  });

  it("returns error when project not found", async () => {
    // 1. db.select(projects) -- empty result (not found)
    pushResult([]);

    const result = await launchProject("p-999", "ws-1");

    expect(result).toEqual({ success: false, error: "Project not found" });
  });
});

// ───────────────────── dispatchTaskToAgent ─────────────────────

describe("dispatchTaskToAgent", () => {
  it("returns error when not authenticated", async () => {
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await dispatchTaskToAgent("t-1", "ws-1");
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("returns error when task has no assigned agent", async () => {
    // 1. db.select(tasks) -- task with no agentId
    pushResult([
      {
        id: "t-1",
        title: "Do thing",
        description: "desc",
        priority: "high",
        status: "pending",
        agentId: null,
        projectId: "p-1",
      },
    ]);

    const result = await dispatchTaskToAgent("t-1", "ws-1");

    expect(result).toEqual({ success: false, error: "Task has no assigned agent" });
  });

  it("dispatches webhook and logs activity on success", async () => {
    // 1. db.select(tasks)
    pushResult([
      {
        id: "t-1",
        title: "Do thing",
        description: "desc",
        priority: "high",
        status: "pending",
        agentId: "agent-1",
        projectId: "p-1",
      },
    ]);
    // 2. db.select(projects) -- project context for the task
    pushResult([
      {
        id: "p-1",
        name: "Proj",
        instructions: "i",
        orchestrationMode: "manual",
      },
    ]);
    // 3. db.insert(activityLog) -- after successful dispatch
    pushResult([]);

    const result = await dispatchTaskToAgent("t-1", "ws-1");

    expect(result).toEqual({ success: true });
    expect(dispatchToAgent).toHaveBeenCalledWith(
      "agent-1",
      expect.objectContaining({ event: "task.assigned" }),
      "t-1"
    );
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("returns error on dispatch failure", async () => {
    (dispatchToAgent as any).mockResolvedValue({ success: false, error: "Connection refused" });

    // 1. db.select(tasks)
    pushResult([
      {
        id: "t-1",
        title: "Do thing",
        description: "desc",
        priority: "high",
        status: "pending",
        agentId: "agent-1",
        projectId: null,
      },
    ]);

    const result = await dispatchTaskToAgent("t-1", "ws-1");

    expect(result).toEqual({ success: false, error: "Connection refused" });
  });
});

// ───────────────────── createProjectTask ─────────────────────

describe("createProjectTask", () => {
  const baseData = {
    projectId: PROJECT_1,
    workspaceId: WS_ID,
    title: "New Task",
    description: "A task",
    priority: "high",
    assignedAgentId: AGENT_1,
    dependsOnTaskIds: [DEP_1, DEP_2],
  };

  it("creates task with dependencies", async () => {
    // 1. db.insert(tasks) -> returning { id }
    pushResult([{ id: "t-new" }]);
    // 2. db.insert(taskAgents)
    pushResult([]);
    // 3. db.insert(taskDependencies)
    pushResult([]);
    // 4. db.insert(activityLog)
    pushResult([]);

    const result = await createProjectTask(baseData);

    expect(result).toEqual({ success: true, taskId: "t-new" });
    // 4 insert calls: tasks, taskAgents, taskDependencies, activityLog
    expect(mockDb.insert).toHaveBeenCalledTimes(4);
  });

  it("inserts task_agents when assignedAgentId provided", async () => {
    // 1. db.insert(tasks)
    pushResult([{ id: "t-new" }]);
    // 2. db.insert(taskAgents)
    pushResult([]);
    // 3. db.insert(activityLog) -- no deps in this case
    pushResult([]);

    const result = await createProjectTask({
      ...baseData,
      dependsOnTaskIds: [],
    });

    expect(result).toEqual({ success: true, taskId: "t-new" });
    // 3 insert calls: tasks, taskAgents, activityLog (no taskDependencies)
    expect(mockDb.insert).toHaveBeenCalledTimes(3);
  });

  it("logs task_created activity", async () => {
    // 1. db.insert(tasks)
    pushResult([{ id: "t-new" }]);
    // 2. db.insert(activityLog) -- no agent, no deps
    pushResult([]);

    const result = await createProjectTask({
      ...baseData,
      assignedAgentId: undefined,
      dependsOnTaskIds: [],
    });

    expect(result).toEqual({ success: true, taskId: "t-new" });
    // 2 insert calls: tasks, activityLog (no taskAgents, no taskDependencies)
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });
});

// ───────────────────── addProjectFile ─────────────────────

describe("addProjectFile", () => {
  const baseData = {
    projectId: PROJECT_1,
    workspaceId: WS_ID,
    fileName: "readme.md",
    filePath: "/uploads/readme.md",
    fileSize: 1024,
    mimeType: "text/markdown",
  };

  it("returns error when not authenticated", async () => {
    (requireAuth as any).mockRejectedValue(new Error("Unauthorized"));

    const result = await addProjectFile(baseData);
    expect(result).toEqual({ success: false, error: "Not authenticated" });
  });

  it("inserts project file and logs activity", async () => {
    // 1. db.insert(projectFiles)
    pushResult([]);
    // 2. db.insert(activityLog)
    pushResult([]);

    const result = await addProjectFile(baseData);

    expect(result).toEqual({ success: true });
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("throws on insert failure (no top-level try/catch)", async () => {
    // 1. db.insert(projectFiles) -- error
    pushError(new Error("Storage limit exceeded"));

    await expect(addProjectFile(baseData)).rejects.toThrow("Storage limit exceeded");
  });
});
