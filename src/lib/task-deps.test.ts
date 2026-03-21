import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb } from "@/__tests__/mocks/drizzle";
import {
  getReadyTasks,
  getBlockingTasks,
  getDependencyGraph,
  canTaskStart,
  getDownstreamTasks,
} from "./task-deps";

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));

// Helper: create a minimal task row
function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: "task-1",
    title: "Test Task",
    description: null,
    status: "pending",
    priority: "medium",
    agent_id: null,
    assigned_to: null,
    created_by: null,
    project_id: "proj-1",
    result: null,
    workspace_id: "ws-1",
    created_at: "2026-02-27T00:00:00Z",
    updated_at: "2026-02-27T00:00:00Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("getReadyTasks", () => {
  it("returns pending tasks with no dependencies", async () => {
    const task = makeTask({ id: "t1", status: "pending" });

    // 1st select: pending tasks
    pushResult([task]);
    // 2nd select: task_dependencies — no deps
    pushResult([]);

    const result = await getReadyTasks("proj-1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
  });

  it("returns empty array when no pending tasks exist", async () => {
    // No pending tasks
    pushResult([]);

    const result = await getReadyTasks("proj-1");
    expect(result).toEqual([]);
  });

  it("returns only tasks whose dependencies are all completed", async () => {
    const t1 = makeTask({ id: "t1", status: "pending" });
    const t2 = makeTask({ id: "t2", status: "pending" });

    // 1st select: pending tasks
    pushResult([t1, t2]);
    // 2nd select: task_dependencies
    pushResult([
      { taskId: "t1", dependsOnTaskId: "dep-1" },
      { taskId: "t2", dependsOnTaskId: "dep-2" },
    ]);
    // 3rd select: statuses of dep-1 and dep-2
    pushResult([
      { id: "dep-1", status: "completed" },
      { id: "dep-2", status: "in_progress" },
    ]);

    const result = await getReadyTasks("proj-1");
    // Only t1 should be ready (dep-1 is completed), t2 is blocked (dep-2 still in_progress)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
  });

  it("excludes tasks with incomplete dependencies", async () => {
    const t1 = makeTask({ id: "t1", status: "pending" });

    pushResult([t1]);
    pushResult([{ taskId: "t1", dependsOnTaskId: "dep-1" }]);
    pushResult([{ id: "dep-1", status: "in_progress" }]);

    const result = await getReadyTasks("proj-1");
    expect(result).toEqual([]);
  });

  it("throws on tasks query error", async () => {
    pushError(new Error("DB error"));

    await expect(getReadyTasks("proj-1")).rejects.toThrow("DB error");
  });
});

describe("getBlockingTasks", () => {
  it("returns empty array when no dependencies exist", async () => {
    // select task_dependencies — no deps
    pushResult([]);

    const result = await getBlockingTasks("t1");
    expect(result).toEqual([]);
  });

  it("returns incomplete dependencies that block the task", async () => {
    // select task_dependencies
    pushResult([{ dependsOnTaskId: "dep-1" }]);
    // select tasks — dep-1 is in_progress (not completed, so it blocks)
    const blockingTask = makeTask({ id: "dep-1", status: "in_progress" });
    pushResult([blockingTask]);

    const result = await getBlockingTasks("t1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dep-1");
  });

  it("returns empty array when all dependencies are completed", async () => {
    // select task_dependencies — has dep
    pushResult([{ dependsOnTaskId: "dep-1" }]);
    // select tasks with neq("status", "completed") — returns nothing (all completed)
    pushResult([]);

    const result = await getBlockingTasks("t1");
    expect(result).toEqual([]);
  });
});

describe("getDependencyGraph", () => {
  it("returns empty graph for project with no tasks", async () => {
    pushResult([]);

    const result = await getDependencyGraph("proj-1");
    expect(result).toEqual({ tasks: {}, edges: [] });
  });

  it("returns tasks and edges for a project", async () => {
    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });

    // select tasks
    pushResult([t1, t2]);
    // select task_dependencies
    pushResult([{ taskId: "t2", dependsOnTaskId: "t1" }]);

    const result = await getDependencyGraph("proj-1");
    expect(Object.keys(result.tasks)).toHaveLength(2);
    expect(result.tasks["t1"]).toBeDefined();
    expect(result.tasks["t2"]).toBeDefined();
    expect(result.edges).toEqual([{ from: "t2", to: "t1" }]);
  });
});

describe("canTaskStart", () => {
  it("returns true when there are no blocking tasks", async () => {
    // getBlockingTasks: select task_dependencies returns no deps
    pushResult([]);

    const result = await canTaskStart("t1");
    expect(result).toBe(true);
  });

  it("returns false when there are blocking tasks", async () => {
    // getBlockingTasks: select task_dependencies
    pushResult([{ dependsOnTaskId: "dep-1" }]);
    // getBlockingTasks: select tasks — dep-1 is not completed
    pushResult([makeTask({ id: "dep-1", status: "in_progress" })]);

    const result = await canTaskStart("t1");
    expect(result).toBe(false);
  });
});

describe("getDownstreamTasks", () => {
  it("returns tasks that depend on the given task", async () => {
    // select task_dependencies
    pushResult([{ taskId: "t2" }]);
    // select tasks
    const downstream = makeTask({ id: "t2" });
    pushResult([downstream]);

    const result = await getDownstreamTasks("t1");
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });

  it("returns empty array when no downstream tasks exist", async () => {
    // select task_dependencies — no downstream
    pushResult([]);

    const result = await getDownstreamTasks("t1");
    expect(result).toEqual([]);
  });
});
