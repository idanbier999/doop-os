import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import { AgentsSettings } from "./agents-settings";

// --- Mocks ---

const mockUseWorkspace = vi.fn(() => ({
  workspaceId: "ws-001",
  userId: "user-001",
  userRole: "owner",
  fleetScope: "all" as const,
  setFleetScope: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => mockUseWorkspace(),
}));

vi.mock("@/contexts/notification-context", () => ({
  useNotifications: vi.fn(() => ({ addToast: vi.fn() })),
}));

const mockFrom = vi.fn().mockReturnValue({
  select: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  order: vi.fn().mockResolvedValue({ data: [] }),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
});

vi.mock("@/hooks/use-supabase", () => ({
  useSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock("@/app/dashboard/settings/actions", () => ({
  testWebhook: vi.fn(),
}));

vi.mock("@/components/ui/modal", () => ({
  Modal: ({ open, children, title }: { open: boolean; children: React.ReactNode; title: string }) =>
    open ? <div data-testid={`modal-${title}`}>{children}</div> : null,
}));

vi.mock("@/components/agents/reassign-owner-modal", () => ({
  ReassignOwnerModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reassign-modal">Reassign Modal</div> : null,
}));

const mockMemberMap = new Map([
  ["user-001", { userId: "user-001", name: "Alice", email: "alice@example.com", role: "owner" }],
  ["user-002", { userId: "user-002", name: "Bob", email: "bob@example.com", role: "member" }],
]);

vi.mock("@/lib/workspace-members", () => ({
  getWorkspaceMemberMap: vi.fn(() => Promise.resolve(mockMemberMap)),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
  })),
}));

// --- Helpers ---

function makeAgent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "agent-1",
    workspace_id: "ws-001",
    name: "Test Agent",
    agent_type: "scraper",
    health: "healthy",
    stage: "production",
    last_seen_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: null,
    platform: null,
    description: null,
    capabilities: null,
    webhook_url: null,
    webhook_secret: null,
    api_key: "key-abcd1234efgh5678",
    tags: [],
    owner_id: "user-001",
    ...overrides,
  };
}

function setupAgents(agents: ReturnType<typeof makeAgent>[]) {
  mockFrom.mockReturnValue({
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    order: vi.fn().mockResolvedValue({ data: agents }),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
  });
}

// --- Tests ---

describe("AgentsSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseWorkspace.mockReturnValue({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "all",
      setFleetScope: vi.fn(),
    });
  });

  describe("Owner column", () => {
    it("displays owner name from member map", async () => {
      setupAgents([makeAgent({ id: "a-1", name: "Agent Alpha", owner_id: "user-001" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Alice")).toBeInTheDocument();
    });

    it('shows "Unassigned" for null owner_id', async () => {
      setupAgents([makeAgent({ id: "a-2", name: "Agent Beta", owner_id: null })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Unassigned")).toBeInTheDocument();
    });
  });

  describe("Permission: owner role", () => {
    it("shows Delete button for own agent", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-001" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Delete")).toBeInTheDocument();
    });

    it("shows Reassign button", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-002" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Reassign")).toBeInTheDocument();
    });

    it("shows Delete button for other user's agent (admin/owner can edit any)", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-002" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Delete")).toBeInTheDocument();
    });
  });

  describe("Permission: admin role", () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        workspaceId: "ws-001",
        userId: "user-001",
        userRole: "admin",
        fleetScope: "all",
        setFleetScope: vi.fn(),
      });
    });

    it("shows Reassign button", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-002" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Reassign")).toBeInTheDocument();
    });

    it("shows Delete button for any agent", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-002" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Delete")).toBeInTheDocument();
    });
  });

  describe("Permission: member role", () => {
    beforeEach(() => {
      mockUseWorkspace.mockReturnValue({
        workspaceId: "ws-001",
        userId: "user-001",
        userRole: "member",
        fleetScope: "all",
        setFleetScope: vi.fn(),
      });
    });

    it("shows Delete for own agent", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-001" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Delete")).toBeInTheDocument();
    });

    it("hides Delete for other user's agent", async () => {
      setupAgents([makeAgent({ id: "a-1", name: "Other Agent", owner_id: "user-002" })]);
      render(<AgentsSettings />);
      await screen.findByText("Other Agent");
      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    });

    it("hides Reassign button for member role", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-001" })]);
      render(<AgentsSettings />);
      await screen.findByText("Test Agent");
      expect(screen.queryByText("Reassign")).not.toBeInTheDocument();
    });

    it("disables Tags Edit button for other user's agent", async () => {
      setupAgents([makeAgent({ id: "a-1", name: "Other Agent", owner_id: "user-002" })]);
      render(<AgentsSettings />);
      await screen.findByText("Other Agent");
      // The Tags column has an Edit button
      const editButtons = screen.getAllByText("Edit");
      // First Edit button is for tags
      expect(editButtons[0]).toBeDisabled();
    });

    it("enables Tags Edit button for own agent", async () => {
      setupAgents([makeAgent({ id: "a-1", owner_id: "user-001" })]);
      render(<AgentsSettings />);
      await screen.findByText("Test Agent");
      const editButtons = screen.getAllByText("Edit");
      expect(editButtons[0]).not.toBeDisabled();
    });
  });
});
