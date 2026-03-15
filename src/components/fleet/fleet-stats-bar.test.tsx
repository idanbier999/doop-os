import { render, screen } from "@testing-library/react";
import { FleetStatsBar } from "@/components/fleet/fleet-stats-bar";

vi.mock("@/hooks/use-realtime", () => ({
  useRealtime: vi.fn(),
}));

vi.mock("@/hooks/use-supabase", () => ({
  useSupabase: vi.fn(() => ({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
    }),
  })),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "ws-001",
    userId: "user-001",
    userRole: "owner",
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

const defaultProps = {
  initialAgentCounts: {
    total: 10,
    healthy: 7,
    degraded: 2,
    critical: 1,
    offline: 0,
  },
  initialOpenProblems: { total: 3, critical: 1 },
  initialTasksInFlight: 5,
  problemsSparkline: [{ value: 1 }, { value: 2 }, { value: 3 }],
  tasksSparkline: [{ value: 4 }, { value: 5 }, { value: 6 }],
  yesterdayOpenProblems: 2,
  yesterdayTasksInFlight: 4,
};

describe("FleetStatsBar", () => {
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
    // Both Open Problems (3 vs 2) and Tasks in Flight (5 vs 4) are up by 1
    const deltas = screen.getAllByText(/▲/);
    expect(deltas.length).toBe(2);
  });
});
