import { render, screen } from "@testing-library/react";

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: vi.fn(() => ({
    workspaceId: "ws-001",
    userId: "user-001",
    userRole: "owner",
  })),
}));

vi.mock("@/contexts/notification-context", () => ({
  useNotifications: vi.fn(() => ({
    addToast: vi.fn(),
    dismissToast: vi.fn(),
  })),
}));

vi.mock("@/app/dashboard/agents/quota-actions", () => ({
  getQuotas: vi.fn(),
  upsertQuota: vi.fn(),
  deleteQuota: vi.fn(),
}));

vi.mock("@/components/ui/modal", () => ({
  Modal: ({ open, children, title }: { open: boolean; children: React.ReactNode; title?: string }) =>
    open ? <div data-testid="modal"><span>{title}</span>{children}</div> : null,
}));

import { useWorkspace } from "@/contexts/workspace-context";
import { getQuotas } from "@/app/dashboard/agents/quota-actions";
import { AgentQuotas } from "./agent-quotas";

const agents = [
  { id: "agent-1", name: "Scraper Bot" },
  { id: "agent-2", name: "Analyzer" },
];

const quotaData = [
  {
    id: "q-1",
    workspace_id: "ws-001",
    agent_id: null,
    max_requests_per_minute: 60,
    max_requests_per_hour: 1000,
    updated_at: "2025-01-01T00:00:00Z",
  },
  {
    id: "q-2",
    workspace_id: "ws-001",
    agent_id: "agent-1",
    max_requests_per_minute: 30,
    max_requests_per_hour: 500,
    updated_at: "2025-01-01T00:00:00Z",
  },
];

describe("AgentQuotas", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getQuotas as any).mockResolvedValue({ success: true, quotas: quotaData });
  });

  it("renders table with quota data", async () => {
    render(<AgentQuotas agents={agents} workspaceId="ws-001" />);

    expect(await screen.findByText("Workspace Default")).toBeInTheDocument();
    expect(screen.getByText("Scraper Bot")).toBeInTheDocument();
    expect(screen.getByText("60")).toBeInTheDocument();
    expect(screen.getByText("1000")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("500")).toBeInTheDocument();
  });

  it("hides edit/delete buttons for non-admin users", async () => {
    (useWorkspace as any).mockReturnValue({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "member",
    });

    render(<AgentQuotas agents={agents} workspaceId="ws-001" />);

    await screen.findByText("Workspace Default");

    expect(screen.queryByText("Edit")).not.toBeInTheDocument();
    expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    expect(screen.queryByText("Add Quota")).not.toBeInTheDocument();
  });
});
