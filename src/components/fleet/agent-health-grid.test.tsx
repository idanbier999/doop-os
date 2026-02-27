import { render, screen } from "@testing-library/react";
import { AgentHealthGrid } from "@/components/fleet/agent-health-grid";

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
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

function makeAgent(overrides: Record<string, unknown>) {
  return {
    id: "agent-1",
    workspace_id: "ws-001",
    name: "Test Agent",
    agent_type: "scraper",
    health: "healthy",
    status: "active",
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: null,
    ...overrides,
  };
}

describe("AgentHealthGrid", () => {
  it("renders empty state message when no agents", () => {
    render(
      <AgentHealthGrid
        initialAgents={[]}
        agentCurrentTask={{}}
        agentHealthHistory={{}}
      />
    );
    expect(
      screen.getByText(/No agents registered/)
    ).toBeInTheDocument();
  });

  it("renders agent names in cards", () => {
    const agents = [
      makeAgent({ id: "a-1", name: "Alpha Bot" }),
      makeAgent({ id: "a-2", name: "Beta Bot" }),
    ];

    render(
      <AgentHealthGrid
        initialAgents={agents as any}
        agentCurrentTask={{}}
        agentHealthHistory={{}}
      />
    );

    expect(screen.getByText("Alpha Bot")).toBeInTheDocument();
    expect(screen.getByText("Beta Bot")).toBeInTheDocument();
  });

  it("sorts agents by health (critical first, healthy last)", () => {
    const agents = [
      makeAgent({ id: "a-healthy", name: "Healthy Agent", health: "healthy" }),
      makeAgent({ id: "a-critical", name: "Critical Agent", health: "critical" }),
      makeAgent({ id: "a-degraded", name: "Degraded Agent", health: "degraded" }),
    ];

    render(
      <AgentHealthGrid
        initialAgents={agents as any}
        agentCurrentTask={{}}
        agentHealthHistory={{}}
      />
    );

    const links = screen.getAllByRole("link");
    // Critical should be first, then degraded, then healthy
    expect(links[0]).toHaveTextContent("Critical Agent");
    expect(links[1]).toHaveTextContent("Degraded Agent");
    expect(links[2]).toHaveTextContent("Healthy Agent");
  });

  it("shows current task as status line", () => {
    const agents = [makeAgent({ id: "a-1", name: "Worker" })];
    const currentTasks = { "a-1": "Build dashboard" };

    render(
      <AgentHealthGrid
        initialAgents={agents as any}
        agentCurrentTask={currentTasks}
        agentHealthHistory={{}}
      />
    );

    expect(screen.getByText("Working on: Build dashboard")).toBeInTheDocument();
  });

  it('shows "Idle" for agents without current task', () => {
    const agents = [
      makeAgent({ id: "a-1", name: "Idle Agent", health: "healthy" }),
    ];

    render(
      <AgentHealthGrid
        initialAgents={agents as any}
        agentCurrentTask={{}}
        agentHealthHistory={{}}
      />
    );

    expect(screen.getByText("Idle")).toBeInTheDocument();
  });
});
