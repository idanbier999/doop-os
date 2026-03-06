import { render, screen } from "@testing-library/react";
import { AgentHealthGrid } from "@/components/fleet/agent-health-grid";
import { useWorkspace } from "@/contexts/workspace-context";

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
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
}));

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  })),
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
    owner_id: "user-001",
    ...overrides,
  };
}

function setScope(scope: "all" | "mine") {
  vi.mocked(useWorkspace).mockReturnValue({
    workspaceId: "ws-001",
    userId: "user-001",
    userRole: "owner",
    fleetScope: scope,
    setFleetScope: vi.fn(),
  } as any);
}

describe("AgentHealthGrid", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setScope("all");
  });

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

  it("filters to only owned agents when scope is mine", () => {
    setScope("mine");
    const agents = [
      makeAgent({ id: "a-1", name: "My Agent", owner_id: "user-001" }),
      makeAgent({ id: "a-2", name: "Other Agent", owner_id: "user-002" }),
      makeAgent({ id: "a-3", name: "Also Mine", owner_id: "user-001" }),
    ];

    render(
      <AgentHealthGrid
        initialAgents={agents as any}
        agentCurrentTask={{}}
        agentHealthHistory={{}}
      />
    );

    expect(screen.getByText("My Agent")).toBeInTheDocument();
    expect(screen.getByText("Also Mine")).toBeInTheDocument();
    expect(screen.queryByText("Other Agent")).not.toBeInTheDocument();
  });

  it("shows all agents when scope is all", () => {
    setScope("all");
    const agents = [
      makeAgent({ id: "a-1", name: "My Agent", owner_id: "user-001" }),
      makeAgent({ id: "a-2", name: "Other Agent", owner_id: "user-002" }),
    ];

    render(
      <AgentHealthGrid
        initialAgents={agents as any}
        agentCurrentTask={{}}
        agentHealthHistory={{}}
      />
    );

    expect(screen.getByText("My Agent")).toBeInTheDocument();
    expect(screen.getByText("Other Agent")).toBeInTheDocument();
  });

  it("shows empty state when no owned agents in mine scope", () => {
    setScope("mine");
    const agents = [
      makeAgent({ id: "a-1", name: "Other Agent", owner_id: "user-002" }),
      makeAgent({ id: "a-2", name: "Another Other", owner_id: "user-003" }),
    ];

    render(
      <AgentHealthGrid
        initialAgents={agents as any}
        agentCurrentTask={{}}
        agentHealthHistory={{}}
      />
    );

    expect(screen.queryByText("Other Agent")).not.toBeInTheDocument();
    expect(screen.getByText("No agents in your fleet")).toBeInTheDocument();
  });
});
