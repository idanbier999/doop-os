import { render, screen } from "@testing-library/react";
import { FleetStatsBar } from "@/components/fleet/fleet-stats-bar";
import { useWorkspace } from "@/contexts/workspace-context";
import { useRealtime } from "@/hooks/use-realtime";

vi.mock("@/hooks/use-realtime", () => ({
  useRealtime: vi.fn(),
}));

const mockIn = vi.fn().mockReturnThis();
const mockEq = vi.fn().mockReturnThis();
const mockSelect = vi.fn(() => ({ eq: mockEq, in: mockIn }));
const mockFrom = vi.fn(() => ({ select: mockSelect }));

vi.mock("@/hooks/use-supabase", () => ({
  useSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "ws-001",
    userId: "user-001",
    userRole: "owner",
    fleetScope: "all",
    setFleetScope: vi.fn(),
  })),
}));

vi.mock("recharts", () => ({
  LineChart: ({ children, ...props }: any) => (
    <div data-testid="line-chart" {...props}>
      {children}
    </div>
  ),
  Line: (props: any) => <div data-testid="line" />,
}));

// Mixed ownership: user-001 owns 5 healthy + 1 degraded + 1 critical = 7 agents
// user-002 owns 2 healthy + 1 degraded = 3 agents
// Total: 7 healthy, 2 degraded, 1 critical = 10 agents
const defaultProps = {
  initialAgentCounts: {
    total: 10,
    healthy: 7,
    degraded: 2,
    critical: 1,
    offline: 0,
  },
  initialAgents: [
    { id: "a-1", health: "healthy", owner_id: "user-001" },
    { id: "a-2", health: "healthy", owner_id: "user-001" },
    { id: "a-3", health: "healthy", owner_id: "user-001" },
    { id: "a-4", health: "healthy", owner_id: "user-001" },
    { id: "a-5", health: "healthy", owner_id: "user-001" },
    { id: "a-6", health: "healthy", owner_id: "user-002" },
    { id: "a-7", health: "healthy", owner_id: "user-002" },
    { id: "a-8", health: "degraded", owner_id: "user-001" },
    { id: "a-9", health: "degraded", owner_id: "user-002" },
    { id: "a-10", health: "critical", owner_id: "user-001" },
  ],
  initialOpenProblems: { total: 3, critical: 1 },
  initialTasksInFlight: 5,
  problemsSparkline: [{ value: 1 }, { value: 2 }, { value: 3 }],
  tasksSparkline: [{ value: 4 }, { value: 5 }, { value: 6 }],
  yesterdayOpenProblems: 2,
  yesterdayTasksInFlight: 4,
};

function setScope(scope: "all" | "mine") {
  vi.mocked(useWorkspace).mockReturnValue({
    workspaceId: "ws-001",
    userId: "user-001",
    userRole: "owner",
    fleetScope: scope,
    setFleetScope: vi.fn(),
  } as any);
}

describe("FleetStatsBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setScope("all");
  });

  it("renders Fleet Health card with healthy/total counts", () => {
    render(<FleetStatsBar {...defaultProps} />);
    expect(screen.getByText("Fleet Health")).toBeInTheDocument();
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });

  it("renders Open Problems card with total count", () => {
    render(<FleetStatsBar {...defaultProps} />);
    expect(screen.getByText("Open Problems")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders Tasks in Flight card with count", () => {
    render(<FleetStatsBar {...defaultProps} />);
    expect(screen.getByText("Tasks in Flight")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("shows critical count when > 0", () => {
    render(<FleetStatsBar {...defaultProps} />);
    expect(screen.getByText("1 critical")).toBeInTheDocument();
  });

  it("shows delta indicator when yesterday differs from today", () => {
    render(<FleetStatsBar {...defaultProps} />);
    const deltas = screen.getAllByText(/▲/);
    expect(deltas.length).toBe(2);
  });

  it("shows all agent health counts when scope is all", () => {
    setScope("all");
    render(<FleetStatsBar {...defaultProps} />);
    // All 10 agents: 7 healthy
    expect(screen.getByText("7/10")).toBeInTheDocument();
  });

  it("shows only owned agent health counts when scope is mine", () => {
    setScope("mine");
    render(<FleetStatsBar {...defaultProps} />);
    // user-001 owns: 5 healthy, 1 degraded, 1 critical = 7 agents total, 5 healthy
    expect(screen.getByText("5/7")).toBeInTheDocument();
  });

  it("refetches problems using scoped agent IDs when scope is mine", () => {
    setScope("mine");
    render(<FleetStatsBar {...defaultProps} />);

    // Find the problems realtime callback
    const realtimeCalls = vi.mocked(useRealtime).mock.calls;
    const problemsCall = realtimeCalls.find((c) => c[0].table === "problems");
    expect(problemsCall).toBeDefined();

    // Trigger refetch
    const refetchProblems = problemsCall![0].onPayload;
    refetchProblems({} as any);

    // Verify supabase was called with scoped agent IDs (user-001 agents only)
    expect(mockFrom).toHaveBeenCalledWith("problems");
    const ownedIds = ["a-1", "a-2", "a-3", "a-4", "a-5", "a-8", "a-10"];
    expect(mockIn).toHaveBeenCalledWith("agent_id", ownedIds);
  });

  it("refetches tasks using scoped agent IDs when scope is mine", () => {
    setScope("mine");
    render(<FleetStatsBar {...defaultProps} />);

    const realtimeCalls = vi.mocked(useRealtime).mock.calls;
    const tasksCall = realtimeCalls.find((c) => c[0].table === "tasks");
    expect(tasksCall).toBeDefined();

    const refetchTasks = tasksCall![0].onPayload;
    refetchTasks({} as any);

    // Verify supabase was called with scoped agent IDs (user-001 agents only)
    expect(mockFrom).toHaveBeenCalledWith("tasks");
    const ownedIds = ["a-1", "a-2", "a-3", "a-4", "a-5", "a-8", "a-10"];
    expect(mockIn).toHaveBeenCalledWith("agent_id", ownedIds);
  });
});
