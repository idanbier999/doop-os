import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  mockResolve,
  mockReject,
  type MockSupabaseChain,
} from "@/__tests__/mocks/supabase";
import {
  getReadyTasks,
  getBlockingTasks,
  getDependencyGraph,
  canTaskStart,
  getDownstreamTasks,
} from "./task-deps";

// Mock the client module so getSupabase fallback doesn't create a real client
vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => {
    const { client } = createMockSupabaseClient();
    return client;
  }),
}));

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

// Helper to make a fresh chain with data
function chainWith(data: unknown) {
  const { chain } = createMockSupabaseClient();
  mockResolve(chain, data);
  return chain;
}

function chainWithError(message: string) {
  const { chain } = createMockSupabaseClient();
  mockReject(chain, { message });
  return chain;
}

describe("getReadyTasks", () => {
  it("returns pending tasks with no dependencies", async () => {
    const { client, from } = createMockSupabaseClient();

    const task = makeTask({ id: "t1", status: "pending" });

    // 1st from("tasks") — pending tasks
    from.mockReturnValueOnce(chainWith([task]));
    // 2nd from("task_dependencies") — no deps
    from.mockReturnValueOnce(chainWith([]));

    const result = await getReadyTasks("proj-1", client as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
  });

  it("returns empty array when no pending tasks exist", async () => {
    const { client, from } = createMockSupabaseClient();

    // No pending tasks
    from.mockReturnValueOnce(chainWith([]));

    const result = await getReadyTasks("proj-1", client as any);
    expect(result).toEqual([]);
  });

  it("returns only tasks whose dependencies are all completed", async () => {
    const { client, from } = createMockSupabaseClient();

    const t1 = makeTask({ id: "t1", status: "pending" });
    const t2 = makeTask({ id: "t2", status: "pending" });

    // 1st from("tasks") — pending tasks
    from.mockReturnValueOnce(chainWith([t1, t2]));
    // 2nd from("task_dependencies") — t1 depends on dep-1, t2 depends on dep-2
    from.mockReturnValueOnce(
      chainWith([
        { task_id: "t1", depends_on_task_id: "dep-1" },
        { task_id: "t2", depends_on_task_id: "dep-2" },
      ])
    );
    // 3rd from("tasks") — statuses of dep-1 and dep-2
    from.mockReturnValueOnce(
      chainWith([
        { id: "dep-1", status: "completed" },
        { id: "dep-2", status: "in_progress" },
      ])
    );

    const result = await getReadyTasks("proj-1", client as any);
    // Only t1 should be ready (dep-1 is completed), t2 is blocked (dep-2 still in_progress)
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t1");
  });

  it("excludes tasks with incomplete dependencies", async () => {
    const { client, from } = createMockSupabaseClient();

    const t1 = makeTask({ id: "t1", status: "pending" });

    from.mockReturnValueOnce(chainWith([t1]));
    from.mockReturnValueOnce(chainWith([{ task_id: "t1", depends_on_task_id: "dep-1" }]));
    from.mockReturnValueOnce(chainWith([{ id: "dep-1", status: "in_progress" }]));

    const result = await getReadyTasks("proj-1", client as any);
    expect(result).toEqual([]);
  });

  it("returns empty array on tasks query error", async () => {
    const { client, from } = createMockSupabaseClient();

    from.mockReturnValueOnce(chainWithError("DB error"));

    const result = await getReadyTasks("proj-1", client as any);
    expect(result).toEqual([]);
  });
});

describe("getBlockingTasks", () => {
  it("returns empty array when no dependencies exist", async () => {
    const { client, from } = createMockSupabaseClient();

    // from("task_dependencies") — no deps
    from.mockReturnValueOnce(chainWith([]));

    const result = await getBlockingTasks("t1", client as any);
    expect(result).toEqual([]);
  });

  it("returns incomplete dependencies that block the task", async () => {
    const { client, from } = createMockSupabaseClient();

    // from("task_dependencies")
    from.mockReturnValueOnce(chainWith([{ depends_on_task_id: "dep-1" }]));
    // from("tasks") — dep-1 is in_progress (not completed, so it blocks)
    const blockingTask = makeTask({ id: "dep-1", status: "in_progress" });
    from.mockReturnValueOnce(chainWith([blockingTask]));

    const result = await getBlockingTasks("t1", client as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("dep-1");
  });

  it("returns empty array when all dependencies are completed", async () => {
    const { client, from } = createMockSupabaseClient();

    // from("task_dependencies") — has dep
    from.mockReturnValueOnce(chainWith([{ depends_on_task_id: "dep-1" }]));
    // from("tasks") with neq("status", "completed") — returns nothing (all completed)
    from.mockReturnValueOnce(chainWith([]));

    const result = await getBlockingTasks("t1", client as any);
    expect(result).toEqual([]);
  });
});

describe("getDependencyGraph", () => {
  it("returns empty graph for project with no tasks", async () => {
    const { client, from } = createMockSupabaseClient();

    from.mockReturnValueOnce(chainWith([]));

    const result = await getDependencyGraph("proj-1", client as any);
    expect(result).toEqual({ tasks: {}, edges: [] });
  });

  it("returns tasks and edges for a project", async () => {
    const { client, from } = createMockSupabaseClient();

    const t1 = makeTask({ id: "t1" });
    const t2 = makeTask({ id: "t2" });

    // from("tasks")
    from.mockReturnValueOnce(chainWith([t1, t2]));
    // from("task_dependencies")
    from.mockReturnValueOnce(chainWith([{ task_id: "t2", depends_on_task_id: "t1" }]));

    const result = await getDependencyGraph("proj-1", client as any);
    expect(Object.keys(result.tasks)).toHaveLength(2);
    expect(result.tasks["t1"]).toBeDefined();
    expect(result.tasks["t2"]).toBeDefined();
    expect(result.edges).toEqual([{ from: "t2", to: "t1" }]);
  });
});

describe("canTaskStart", () => {
  it("returns true when there are no blocking tasks", async () => {
    const { client, from } = createMockSupabaseClient();

    // getBlockingTasks: from("task_dependencies") returns no deps
    from.mockReturnValueOnce(chainWith([]));

    const result = await canTaskStart("t1", client as any);
    expect(result).toBe(true);
  });

  it("returns false when there are blocking tasks", async () => {
    const { client, from } = createMockSupabaseClient();

    // getBlockingTasks: from("task_dependencies")
    from.mockReturnValueOnce(chainWith([{ depends_on_task_id: "dep-1" }]));
    // getBlockingTasks: from("tasks") — dep-1 is not completed
    from.mockReturnValueOnce(chainWith([makeTask({ id: "dep-1", status: "in_progress" })]));

    const result = await canTaskStart("t1", client as any);
    expect(result).toBe(false);
  });
});

describe("getDownstreamTasks", () => {
  it("returns tasks that depend on the given task", async () => {
    const { client, from } = createMockSupabaseClient();

    // from("task_dependencies")
    from.mockReturnValueOnce(chainWith([{ task_id: "t2" }]));
    // from("tasks")
    const downstream = makeTask({ id: "t2" });
    from.mockReturnValueOnce(chainWith([downstream]));

    const result = await getDownstreamTasks("t1", client as any);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("t2");
  });

  it("returns empty array when no downstream tasks exist", async () => {
    const { client, from } = createMockSupabaseClient();

    // from("task_dependencies") — no downstream
    from.mockReturnValueOnce(chainWith([]));

    const result = await getDownstreamTasks("t1", client as any);
    expect(result).toEqual([]);
  });
});
