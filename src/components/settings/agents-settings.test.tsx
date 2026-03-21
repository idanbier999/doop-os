// @vitest-environment jsdom
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

const mockGetAgents = vi.fn();
const mockGetWorkspaceMembers = vi.fn();

vi.mock("@/app/dashboard/agents/actions", () => ({
  getAgents: (...args: unknown[]) => mockGetAgents(...args),
  getWorkspaceMembers: (...args: unknown[]) => mockGetWorkspaceMembers(...args),
  updateAgent: vi.fn(),
  generateWebhookSecret: vi.fn(),
  deleteAgent: vi.fn(),
}));

vi.mock("@/app/dashboard/settings/actions", () => ({
  testWebhook: vi.fn(),
}));

vi.mock("@/components/ui/modal", () => ({
  Modal: ({
    open,
    children,
    title,
  }: {
    open: boolean;
    children: React.ReactNode;
    title: string;
  }) => (open ? <div data-testid={`modal-${title}`}>{children}</div> : null),
}));

vi.mock("@/components/agents/reassign-owner-modal", () => ({
  ReassignOwnerModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="reassign-modal">Reassign Modal</div> : null,
}));

const mockMembers = [
  { userId: "user-001", name: "Alice", email: "alice@example.com", role: "owner" },
  { userId: "user-002", name: "Bob", email: "bob@example.com", role: "member" },
];

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
    workspaceId: "ws-001",
    name: "Test Agent",
    agentType: "scraper",
    health: "healthy",
    stage: "production",
    lastSeenAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    metadata: null,
    platform: null,
    description: null,
    capabilities: null,
    webhookUrl: null,
    webhookSecret: null,
    apiKeyPrefix: "doop_abcd123",
    tags: [],
    ownerId: "user-001",
    ...overrides,
  };
}

function setupAgents(agents: ReturnType<typeof makeAgent>[]) {
  mockGetAgents.mockResolvedValue({ success: true, agents });
  mockGetWorkspaceMembers.mockResolvedValue({ success: true, members: mockMembers });
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
      setupAgents([makeAgent({ id: "a-1", name: "Agent Alpha", ownerId: "user-001" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Alice")).toBeInTheDocument();
    });

    it('shows "Unassigned" for null owner_id', async () => {
      setupAgents([makeAgent({ id: "a-2", name: "Agent Beta", ownerId: null })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Unassigned")).toBeInTheDocument();
    });
  });

  describe("Permission: owner role", () => {
    it("shows Delete button for own agent", async () => {
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-001" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Delete")).toBeInTheDocument();
    });

    it("shows Reassign button", async () => {
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-002" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Reassign")).toBeInTheDocument();
    });

    it("shows Delete button for other user's agent (admin/owner can edit any)", async () => {
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-002" })]);
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
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-002" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Reassign")).toBeInTheDocument();
    });

    it("shows Delete button for any agent", async () => {
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-002" })]);
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
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-001" })]);
      render(<AgentsSettings />);
      expect(await screen.findByText("Delete")).toBeInTheDocument();
    });

    it("hides Delete for other user's agent", async () => {
      setupAgents([makeAgent({ id: "a-1", name: "Other Agent", ownerId: "user-002" })]);
      render(<AgentsSettings />);
      await screen.findByText("Other Agent");
      expect(screen.queryByText("Delete")).not.toBeInTheDocument();
    });

    it("hides Reassign button for member role", async () => {
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-001" })]);
      render(<AgentsSettings />);
      await screen.findByText("Test Agent");
      expect(screen.queryByText("Reassign")).not.toBeInTheDocument();
    });

    it("disables Tags Edit button for other user's agent", async () => {
      setupAgents([makeAgent({ id: "a-1", name: "Other Agent", ownerId: "user-002" })]);
      render(<AgentsSettings />);
      await screen.findByText("Other Agent");
      // The Tags column has an Edit button
      const editButtons = screen.getAllByText("Edit");
      // First Edit button is for tags
      expect(editButtons[0]).toBeDisabled();
    });

    it("enables Tags Edit button for own agent", async () => {
      setupAgents([makeAgent({ id: "a-1", ownerId: "user-001" })]);
      render(<AgentsSettings />);
      await screen.findByText("Test Agent");
      const editButtons = screen.getAllByText("Edit");
      expect(editButtons[0]).not.toBeDisabled();
    });
  });
});
