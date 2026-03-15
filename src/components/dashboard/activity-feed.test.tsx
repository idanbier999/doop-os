import { render, screen } from "@testing-library/react";
import { ActivityFeed } from "@/components/dashboard/activity-feed";

vi.mock("@/hooks/use-realtime", () => ({
  useRealtime: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "ws-001",
    userId: "user-001",
    userRole: "owner",
  })),
}));

const agents = [
  { id: "agent-1", name: "Scraper Bot" },
  { id: "agent-2", name: "Analyzer" },
];

describe("ActivityFeed", () => {
  it('renders "No activity yet" when initialActivity is empty', () => {
    render(<ActivityFeed initialActivity={[]} agents={agents} />);
    expect(screen.getByText("No activity yet")).toBeInTheDocument();
  });

  it("renders activity entries with agent names", () => {
    const activity = [
      {
        id: "act-1",
        workspace_id: "ws-001",
        agent_id: "agent-1",
        user_id: null,
        action: "task_completed",
        details: { title: "Fetch data" },
        created_at: new Date().toISOString(),
        agents: { name: "Scraper Bot" },
      },
    ];

    render(<ActivityFeed initialActivity={activity} agents={agents} />);
    expect(screen.getByText("Scraper Bot")).toBeInTheDocument();
  });

  it("displays correct activity descriptions (task_completed)", () => {
    const activity = [
      {
        id: "act-2",
        workspace_id: "ws-001",
        agent_id: "agent-2",
        user_id: null,
        action: "task_completed",
        details: { title: "Analyze report" },
        created_at: new Date().toISOString(),
        agents: { name: "Analyzer" },
      },
    ];

    render(<ActivityFeed initialActivity={activity} agents={agents} />);
    expect(screen.getByText(/completed 'Analyze report'/)).toBeInTheDocument();
  });

  it("displays relative time for each entry", () => {
    const activity = [
      {
        id: "act-3",
        workspace_id: "ws-001",
        agent_id: "agent-1",
        user_id: null,
        action: "task_created",
        details: { title: "New task" },
        created_at: new Date().toISOString(),
        agents: { name: "Scraper Bot" },
      },
    ];

    render(<ActivityFeed initialActivity={activity} agents={agents} />);
    // "Just now" because the created_at is the current time
    expect(screen.getByText("Just now")).toBeInTheDocument();
  });

  it('shows "System" for entries without agent name', () => {
    const activity = [
      {
        id: "act-4",
        workspace_id: "ws-001",
        agent_id: null,
        user_id: "user-001",
        action: "task_created",
        details: { title: "Manual task" },
        created_at: new Date().toISOString(),
        agents: null,
      },
    ];

    render(<ActivityFeed initialActivity={activity} agents={agents} />);
    expect(screen.getByText("System")).toBeInTheDocument();
  });
});
