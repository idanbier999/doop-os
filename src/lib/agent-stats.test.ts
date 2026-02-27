import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockSupabaseClient,
  mockResolve,
  type MockSupabaseChain,
} from "@/__tests__/mocks/supabase";
import { getAgentStats, getAgentStatsMap } from "./agent-stats";

// Helper: create a fresh chain that resolves to given data
function chainWith(data: unknown, count?: number) {
  const { chain } = createMockSupabaseClient();
  // Override the then getter to include count if specified
  Object.defineProperty(chain, "then", {
    get() {
      return (resolve: (val: unknown) => void) =>
        resolve({ data, error: null, count: count ?? null });
    },
    configurable: true,
    enumerable: false,
  });
  return chain;
}

/**
 * Setup from mock for getAgentStats which uses Promise.all with 6 queries:
 * 1. tasks — all tasks for agent (data: tasks[], for completionRate)
 * 2. tasks — active count (head:true, count: N)
 * 3. tasks — completed with timestamps (data: tasks[])
 * 4. problems — all problems (data: problems[])
 * 5. activity_log — 7d count (head:true, count: N)
 * 6. tasks — recent tasks for streak (data: tasks[], ordered)
 */
function setupGetAgentStats(
  from: ReturnType<typeof vi.fn>,
  opts: {
    allTasks?: { id: string; status: string }[];
    activeCount?: number;
    completedTasks?: { created_at: string; updated_at: string }[];
    problems?: { id: string; status: string }[];
    activityCount?: number;
    recentTasks?: { id: string; status: string; updated_at: string }[];
  }
) {
  const {
    allTasks = [],
    activeCount = 0,
    completedTasks = [],
    problems = [],
    activityCount = 0,
    recentTasks = [],
  } = opts;

  // 1. all tasks
  from.mockReturnValueOnce(chainWith(allTasks));
  // 2. active tasks count (head: true)
  from.mockReturnValueOnce(chainWith(null, activeCount));
  // 3. completed tasks with timestamps
  from.mockReturnValueOnce(chainWith(completedTasks));
  // 4. problems
  from.mockReturnValueOnce(chainWith(problems));
  // 5. activity count 7d (head: true)
  from.mockReturnValueOnce(chainWith(null, activityCount));
  // 6. recent tasks for streak
  from.mockReturnValueOnce(chainWith(recentTasks));
}

describe("getAgentStats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00Z"));
  });

  it("calculates completion rate correctly", async () => {
    const { client, from } = createMockSupabaseClient();

    setupGetAgentStats(from, {
      allTasks: [
        { id: "t1", status: "completed" },
        { id: "t2", status: "completed" },
        { id: "t3", status: "cancelled" },
        { id: "t4", status: "in_progress" },
      ],
      completedTasks: [
        {
          created_at: "2026-02-27T00:00:00Z",
          updated_at: "2026-02-27T01:00:00Z",
        },
        {
          created_at: "2026-02-27T02:00:00Z",
          updated_at: "2026-02-27T03:00:00Z",
        },
      ],
    });

    const stats = await getAgentStats(client as any, "agent-1");
    // 2 completed / (2 completed + 1 cancelled) = 67%
    expect(stats.completionRate).toBe(67);
    expect(stats.totalTasksHandled).toBe(4);
  });

  it("returns 0 completion rate when no tasks", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, {});

    const stats = await getAgentStats(client as any, "agent-1");
    expect(stats.completionRate).toBe(0);
    expect(stats.totalTasksHandled).toBe(0);
  });

  it("counts active tasks from the count result", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, { activeCount: 3 });

    const stats = await getAgentStats(client as any, "agent-1");
    expect(stats.activeTasks).toBe(3);
  });

  it("calculates average duration from completed tasks timestamps", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, {
      completedTasks: [
        // 1 hour duration
        {
          created_at: "2026-02-27T00:00:00Z",
          updated_at: "2026-02-27T01:00:00Z",
        },
        // 3 hours duration
        {
          created_at: "2026-02-27T02:00:00Z",
          updated_at: "2026-02-27T05:00:00Z",
        },
      ],
    });

    const stats = await getAgentStats(client as any, "agent-1");
    // Average: (3600000 + 10800000) / 2 = 7200000 ms
    expect(stats.avgDurationMs).toBe(7200000);
  });

  it("returns null avgDurationMs when no completed tasks", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, { completedTasks: [] });

    const stats = await getAgentStats(client as any, "agent-1");
    expect(stats.avgDurationMs).toBeNull();
  });

  it("calculates problem rate as problems per completed task", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, {
      allTasks: [
        { id: "t1", status: "completed" },
        { id: "t2", status: "completed" },
      ],
      problems: [
        { id: "p1", status: "open" },
        { id: "p2", status: "resolved" },
        { id: "p3", status: "open" },
      ],
    });

    const stats = await getAgentStats(client as any, "agent-1");
    // 3 problems / 2 completed = 1.5
    expect(stats.problemRate).toBe(1.5);
    expect(stats.problemsReported).toBe(3);
  });

  it("counts current streak of consecutive completed tasks", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, {
      recentTasks: [
        { id: "t1", status: "completed", updated_at: "2026-02-27T05:00:00Z" },
        { id: "t2", status: "completed", updated_at: "2026-02-27T04:00:00Z" },
        { id: "t3", status: "completed", updated_at: "2026-02-27T03:00:00Z" },
        { id: "t4", status: "cancelled", updated_at: "2026-02-27T02:00:00Z" },
        { id: "t5", status: "completed", updated_at: "2026-02-27T01:00:00Z" },
      ],
    });

    const stats = await getAgentStats(client as any, "agent-1");
    // Streak breaks at t4 (cancelled), so streak = 3
    expect(stats.currentStreak).toBe(3);
  });

  it("breaks streak on cancelled task", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, {
      recentTasks: [
        { id: "t1", status: "cancelled", updated_at: "2026-02-27T05:00:00Z" },
        { id: "t2", status: "completed", updated_at: "2026-02-27T04:00:00Z" },
      ],
    });

    const stats = await getAgentStats(client as any, "agent-1");
    expect(stats.currentStreak).toBe(0);
  });

  it("returns activity count from 7d query", async () => {
    const { client, from } = createMockSupabaseClient();
    setupGetAgentStats(from, { activityCount: 42 });

    const stats = await getAgentStats(client as any, "agent-1");
    expect(stats.activityCount7d).toBe(42);
  });

  vi.useRealTimers();
});

describe("getAgentStatsMap", () => {
  it("returns empty map for empty agentIds", async () => {
    const { client } = createMockSupabaseClient();

    const result = await getAgentStatsMap(client as any, []);
    expect(result.size).toBe(0);
  });

  it("returns completion rate and open problems per agent", async () => {
    const { client, from } = createMockSupabaseClient();

    // 1st from("tasks") — completed/cancelled tasks for all agents
    from.mockReturnValueOnce(
      chainWith([
        { agent_id: "a1", status: "completed" },
        { agent_id: "a1", status: "completed" },
        { agent_id: "a1", status: "cancelled" },
        { agent_id: "a2", status: "completed" },
        { agent_id: "a2", status: "completed" },
      ])
    );
    // 2nd from("problems") — open problems
    from.mockReturnValueOnce(
      chainWith([
        { agent_id: "a1", status: "open" },
        { agent_id: "a2", status: "open" },
        { agent_id: "a2", status: "open" },
      ])
    );

    const result = await getAgentStatsMap(client as any, ["a1", "a2"]);

    expect(result.size).toBe(2);
    // a1: 2 completed / (2 + 1) = 67%
    expect(result.get("a1")).toEqual({ completionRate: 67, openProblems: 1 });
    // a2: 2 completed / 2 = 100%
    expect(result.get("a2")).toEqual({ completionRate: 100, openProblems: 2 });
  });
});
