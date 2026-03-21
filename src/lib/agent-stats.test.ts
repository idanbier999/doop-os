import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createMockDb } from "@/__tests__/mocks/drizzle";
import { getAgentStats, getAgentStatsMap } from "./agent-stats";

const { mockDb, pushResult, reset } = createMockDb();

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));

/**
 * Setup results for getAgentStats which runs 6 parallel db.select() calls via Promise.all:
 * 1. allTasks (select from tasks)
 * 2. activeTasksResult (select count from tasks)
 * 3. completedTasks (select from tasks where status=completed)
 * 4. agentProblems (select from problems)
 * 5. activityResult (select count from activity_log)
 * 6. recentTasks (select from tasks ordered by updated_at)
 */
function setupGetAgentStats(opts: {
  allTasks?: { id: string; status: string }[];
  activeCount?: number;
  completedTasks?: { createdAt: string; updatedAt: string }[];
  problems?: { id: string; status: string }[];
  activityCount?: number;
  recentTasks?: { id: string; status: string; updatedAt: string }[];
}) {
  const {
    allTasks = [],
    activeCount = 0,
    completedTasks = [],
    problems = [],
    activityCount = 0,
    recentTasks = [],
  } = opts;

  // 1. allTasks
  pushResult(allTasks);
  // 2. activeTasksResult (returns [{count: N}])
  pushResult([{ count: activeCount }]);
  // 3. completedTasks
  pushResult(completedTasks);
  // 4. agentProblems
  pushResult(problems);
  // 5. activityResult (returns [{count: N}])
  pushResult([{ count: activityCount }]);
  // 6. recentTasks
  pushResult(recentTasks);
}

describe("getAgentStats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-27T12:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("calculates completion rate correctly", async () => {
    setupGetAgentStats({
      allTasks: [
        { id: "t1", status: "completed" },
        { id: "t2", status: "completed" },
        { id: "t3", status: "cancelled" },
        { id: "t4", status: "in_progress" },
      ],
      completedTasks: [
        {
          createdAt: "2026-02-27T00:00:00Z",
          updatedAt: "2026-02-27T01:00:00Z",
        },
        {
          createdAt: "2026-02-27T02:00:00Z",
          updatedAt: "2026-02-27T03:00:00Z",
        },
      ],
    });

    const stats = await getAgentStats("agent-1");
    // 2 completed / (2 completed + 1 cancelled) = 67%
    expect(stats.completionRate).toBe(67);
    expect(stats.totalTasksHandled).toBe(4);
  });

  it("returns 0 completion rate when no tasks", async () => {
    setupGetAgentStats({});

    const stats = await getAgentStats("agent-1");
    expect(stats.completionRate).toBe(0);
    expect(stats.totalTasksHandled).toBe(0);
  });

  it("counts active tasks from the count result", async () => {
    setupGetAgentStats({ activeCount: 3 });

    const stats = await getAgentStats("agent-1");
    expect(stats.activeTasks).toBe(3);
  });

  it("calculates average duration from completed tasks timestamps", async () => {
    setupGetAgentStats({
      completedTasks: [
        // 1 hour duration
        {
          createdAt: "2026-02-27T00:00:00Z",
          updatedAt: "2026-02-27T01:00:00Z",
        },
        // 3 hours duration
        {
          createdAt: "2026-02-27T02:00:00Z",
          updatedAt: "2026-02-27T05:00:00Z",
        },
      ],
    });

    const stats = await getAgentStats("agent-1");
    // Average: (3600000 + 10800000) / 2 = 7200000 ms
    expect(stats.avgDurationMs).toBe(7200000);
  });

  it("returns null avgDurationMs when no completed tasks", async () => {
    setupGetAgentStats({ completedTasks: [] });

    const stats = await getAgentStats("agent-1");
    expect(stats.avgDurationMs).toBeNull();
  });

  it("calculates problem rate as problems per completed task", async () => {
    setupGetAgentStats({
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

    const stats = await getAgentStats("agent-1");
    // 3 problems / 2 completed = 1.5
    expect(stats.problemRate).toBe(1.5);
    expect(stats.problemsReported).toBe(3);
  });

  it("counts current streak of consecutive completed tasks", async () => {
    setupGetAgentStats({
      recentTasks: [
        { id: "t1", status: "completed", updatedAt: "2026-02-27T05:00:00Z" },
        { id: "t2", status: "completed", updatedAt: "2026-02-27T04:00:00Z" },
        { id: "t3", status: "completed", updatedAt: "2026-02-27T03:00:00Z" },
        { id: "t4", status: "cancelled", updatedAt: "2026-02-27T02:00:00Z" },
        { id: "t5", status: "completed", updatedAt: "2026-02-27T01:00:00Z" },
      ],
    });

    const stats = await getAgentStats("agent-1");
    // Streak breaks at t4 (cancelled), so streak = 3
    expect(stats.currentStreak).toBe(3);
  });

  it("breaks streak on cancelled task", async () => {
    setupGetAgentStats({
      recentTasks: [
        { id: "t1", status: "cancelled", updatedAt: "2026-02-27T05:00:00Z" },
        { id: "t2", status: "completed", updatedAt: "2026-02-27T04:00:00Z" },
      ],
    });

    const stats = await getAgentStats("agent-1");
    expect(stats.currentStreak).toBe(0);
  });

  it("returns activity count from 7d query", async () => {
    setupGetAgentStats({ activityCount: 42 });

    const stats = await getAgentStats("agent-1");
    expect(stats.activityCount7d).toBe(42);
  });
});

describe("getAgentStatsMap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reset();
  });

  it("returns empty map for empty agentIds", async () => {
    const result = await getAgentStatsMap([]);
    expect(result.size).toBe(0);
  });

  it("returns completion rate and open problems per agent", async () => {
    // 1. db.select(tasks) -- completed/cancelled tasks for all agents
    pushResult([
      { agentId: "a1", status: "completed" },
      { agentId: "a1", status: "completed" },
      { agentId: "a1", status: "cancelled" },
      { agentId: "a2", status: "completed" },
      { agentId: "a2", status: "completed" },
    ]);
    // 2. db.select(problems) -- open problems
    pushResult([
      { agentId: "a1", status: "open" },
      { agentId: "a2", status: "open" },
      { agentId: "a2", status: "open" },
    ]);

    const result = await getAgentStatsMap(["a1", "a2"]);

    expect(result.size).toBe(2);
    // a1: 2 completed / (2 + 1) = 67%
    expect(result.get("a1")).toEqual({ completionRate: 67, openProblems: 1 });
    // a2: 2 completed / 2 = 100%
    expect(result.get("a2")).toEqual({ completionRate: 100, openProblems: 2 });
  });
});
