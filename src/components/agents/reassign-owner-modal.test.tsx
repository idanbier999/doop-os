import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ReassignOwnerModal } from "@/components/agents/reassign-owner-modal";
import type { MemberInfo } from "@/lib/workspace-members";

const mockRefresh = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(() => ({
    refresh: mockRefresh,
  })),
}));

const mockSupabase = {};
vi.mock("@/hooks/use-supabase", () => ({
  useSupabase: vi.fn(() => mockSupabase),
}));

const mockReassignAgentOwner = vi.fn();
vi.mock("@/app/dashboard/agents/actions", () => ({
  reassignAgentOwner: (...args: unknown[]) => mockReassignAgentOwner(...args),
}));

const mockGetWorkspaceMemberMap = vi.fn();
vi.mock("@/lib/workspace-members", () => ({
  getWorkspaceMemberMap: (...args: unknown[]) => mockGetWorkspaceMemberMap(...args),
}));

// Mock HTMLDialogElement methods not available in jsdom
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = vi.fn();
  HTMLDialogElement.prototype.close = vi.fn();
});

const members: MemberInfo[] = [
  { userId: "user-1", name: "Alice", email: "alice@test.com", role: "owner" },
  { userId: "user-2", name: "Bob", email: "bob@test.com", role: "member" },
];

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  agentId: "agent-001",
  agentName: "Test Agent",
  currentOwnerId: "user-1",
  workspaceId: "ws-001",
};

describe("ReassignOwnerModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    const memberMap = new Map(members.map((m) => [m.userId, m]));
    mockGetWorkspaceMemberMap.mockResolvedValue(memberMap);
    mockReassignAgentOwner.mockResolvedValue({ success: true });
  });

  it("renders member list when modal opens", async () => {
    render(<ReassignOwnerModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetWorkspaceMemberMap).toHaveBeenCalled();
    });

    const select = screen.getByLabelText("New Owner");
    const options = select.querySelectorAll("option");
    // "Unassigned" + 2 members
    expect(options).toHaveLength(3);
    expect(options[1].textContent).toBe("Alice (current)");
    expect(options[2].textContent).toBe("Bob");
  });

  it("submits reassignAgentOwner with selected member", async () => {
    const user = userEvent.setup();
    render(<ReassignOwnerModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetWorkspaceMemberMap).toHaveBeenCalled();
    });

    const select = screen.getByLabelText("New Owner", { exact: false });
    await user.selectOptions(select, "user-2");

    const submitBtn = screen.getByRole("button", { name: "Reassign", hidden: true });
    await user.click(submitBtn);

    expect(mockReassignAgentOwner).toHaveBeenCalledWith("ws-001", "agent-001", "user-2");
  });

  it("shows error message on failed reassignment", async () => {
    mockReassignAgentOwner.mockResolvedValue({ success: false, error: "Permission denied" });
    const user = userEvent.setup();
    render(<ReassignOwnerModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetWorkspaceMemberMap).toHaveBeenCalled();
    });

    const select = screen.getByLabelText("New Owner", { exact: false });
    await user.selectOptions(select, "user-2");

    const submitBtn = screen.getByRole("button", { name: "Reassign", hidden: true });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText("Permission denied")).toBeInTheDocument();
    });
  });

  it("includes Unassigned option in dropdown", async () => {
    render(<ReassignOwnerModal {...defaultProps} />);

    await waitFor(() => {
      expect(mockGetWorkspaceMemberMap).toHaveBeenCalled();
    });

    const select = screen.getByLabelText("New Owner");
    const options = select.querySelectorAll("option");
    expect(options[0].textContent).toBe("Unassigned");
    expect(options[0].value).toBe("");
  });

  it("calls onClose after successful reassignment", async () => {
    const onClose = vi.fn();
    const user = userEvent.setup();
    render(<ReassignOwnerModal {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(mockGetWorkspaceMemberMap).toHaveBeenCalled();
    });

    const select = screen.getByLabelText("New Owner", { exact: false });
    await user.selectOptions(select, "user-2");

    const submitBtn = screen.getByRole("button", { name: "Reassign", hidden: true });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(onClose).toHaveBeenCalled();
    });
    expect(mockRefresh).toHaveBeenCalled();
  });
});
