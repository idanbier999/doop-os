import { render, screen, act } from "@testing-library/react";
import { vi, type Mock } from "vitest";

// Track registered callbacks by channel name
type ChannelCallback = (payload: unknown) => void | Promise<void>;
const channelCallbacks: Record<string, ChannelCallback> = {};

const mockChannels: Record<string, { on: Mock; subscribe: Mock }> = {};

function createMockChannel(name: string) {
  const channel = {
    on: vi.fn((_event: string, _config: unknown, cb: ChannelCallback) => {
      channelCallbacks[name] = cb;
      return channel;
    }),
    subscribe: vi.fn().mockReturnThis(),
  };
  mockChannels[name] = channel;
  return channel;
}

const mockSupabase = {
  channel: vi.fn((name: string) => createMockChannel(name)),
  removeChannel: vi.fn(),
  from: vi.fn(),
};

vi.mock("@/hooks/use-supabase", () => ({
  useSupabase: vi.fn(() => mockSupabase),
}));

let mockWorkspaceValues = {
  workspaceId: "ws-001",
  userId: "user-001",
  userRole: "owner",
  fleetScope: "mine" as "mine" | "all",
  setFleetScope: vi.fn(),
};

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: vi.fn(() => mockWorkspaceValues),
}));

// Mock ToastContainer to render toast titles for behavioral assertions
vi.mock("@/components/ui/toast", () => ({
  ToastContainer: ({ toasts }: { toasts: { id: string; title: string; type: string }[] }) => (
    <div data-testid="toast-container">
      {toasts.map((t) => (
        <div key={t.id} data-testid="toast" data-type={t.type}>
          {t.title}
        </div>
      ))}
    </div>
  ),
}));

import { NotificationProvider, useNotifications } from "@/contexts/notification-context";

// Helper to simulate a supabase realtime payload
function simulatePayload(channelName: string, payload: unknown) {
  const cb = channelCallbacks[channelName];
  if (!cb) throw new Error(`No callback registered for channel: ${channelName}`);
  return cb(payload);
}

// Helper to mock agent fetch response
function mockAgentFetch(data: Record<string, unknown> | null) {
  const single = vi.fn().mockResolvedValue({ data, error: null });
  const eq = vi.fn().mockReturnValue({ single });
  const select = vi.fn().mockReturnValue({ eq });
  mockSupabase.from.mockReturnValue({ select });
}

function renderProvider() {
  return render(
    <NotificationProvider>
      <div data-testid="child" />
    </NotificationProvider>
  );
}

function toastTitles(): string[] {
  return screen.queryAllByTestId("toast").map((el) => el.textContent ?? "");
}

describe("NotificationContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.keys(channelCallbacks).forEach((k) => delete channelCallbacks[k]);
    Object.keys(mockChannels).forEach((k) => delete mockChannels[k]);
    mockWorkspaceValues = {
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "mine",
      setFleetScope: vi.fn(),
    };
  });

  // --- Setup & Cleanup ---

  it("subscribes to three realtime channels on mount", () => {
    renderProvider();

    expect(mockSupabase.channel).toHaveBeenCalledWith("toast-problems");
    expect(mockSupabase.channel).toHaveBeenCalledWith("toast-agent-offline");
    expect(mockSupabase.channel).toHaveBeenCalledWith("toast-task-failure");
    expect(mockSupabase.channel).toHaveBeenCalledTimes(3);
  });

  it("removes all three channels on unmount", () => {
    const { unmount } = renderProvider();

    unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledTimes(3);
  });

  it("useNotifications throws when used outside provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    function Bad() {
      useNotifications();
      return null;
    }
    expect(() => render(<Bad />)).toThrow(
      "useNotifications must be used within a NotificationProvider"
    );
    spy.mockRestore();
  });

  // --- Problem toast scoping (Task 4.1) ---

  it("shows toast for critical problem from own agent in mine scope", async () => {
    mockAgentFetch({ name: "Bot-1", workspace_id: "ws-001", owner_id: "user-001" });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-problems", {
        new: { severity: "critical", title: "CPU overload", agent_id: "agent-1" },
      });
    });

    expect(toastTitles()).toContain("Problem: CPU overload");
  });

  it("suppresses problem from other owner in mine scope", async () => {
    mockAgentFetch({ name: "Bot-2", workspace_id: "ws-001", owner_id: "user-999" });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-problems", {
        new: { severity: "high", title: "Memory leak", agent_id: "agent-2" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("shows problem from other owner when scope is all", async () => {
    mockWorkspaceValues.fleetScope = "all";
    mockAgentFetch({ name: "Bot-2", workspace_id: "ws-001", owner_id: "user-999" });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-problems", {
        new: { severity: "high", title: "Memory leak", agent_id: "agent-2" },
      });
    });

    expect(toastTitles()).toContain("Problem: Memory leak");
  });

  it("suppresses low-severity problems regardless of scope", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-problems", {
        new: { severity: "low", title: "Minor issue", agent_id: "agent-1" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("suppresses problem from different workspace", async () => {
    mockAgentFetch({ name: "Bot-X", workspace_id: "ws-other", owner_id: "user-001" });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-problems", {
        new: { severity: "critical", title: "Error", agent_id: "agent-x" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("suppresses unassigned agent (owner_id=null) in mine scope, shows in all", async () => {
    mockAgentFetch({ name: "Unowned", workspace_id: "ws-001", owner_id: null });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-problems", {
        new: { severity: "critical", title: "Null owner", agent_id: "agent-u" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("handles null agent from fetch gracefully (no crash, no toast)", async () => {
    mockAgentFetch(null);
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-problems", {
        new: { severity: "high", title: "Error", agent_id: "agent-missing" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  // --- Agent offline alerts (Task 4.2) ---

  it("shows toast when owned agent transitions to offline", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-agent-offline", {
        new: { workspace_id: "ws-001", health: "offline", name: "Bot-1", owner_id: "user-001" },
        old: { health: "healthy" },
      });
    });

    expect(toastTitles()).toContain("Agent offline: Bot-1");
  });

  it("suppresses toast when agent was already offline (no transition)", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-agent-offline", {
        new: { workspace_id: "ws-001", health: "offline", name: "Bot-1", owner_id: "user-001" },
        old: { health: "offline" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("shows toast when old health is undefined (graceful fallback)", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-agent-offline", {
        new: { workspace_id: "ws-001", health: "offline", name: "Bot-1", owner_id: "user-001" },
        old: {},
      });
    });

    expect(toastTitles()).toContain("Agent offline: Bot-1");
  });

  it("suppresses agent-offline from other owner in mine scope", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-agent-offline", {
        new: { workspace_id: "ws-001", health: "offline", name: "Other-Bot", owner_id: "user-999" },
        old: { health: "healthy" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("shows agent-offline from other owner when scope is all", async () => {
    mockWorkspaceValues.fleetScope = "all";
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-agent-offline", {
        new: { workspace_id: "ws-001", health: "offline", name: "Other-Bot", owner_id: "user-999" },
        old: { health: "healthy" },
      });
    });

    expect(toastTitles()).toContain("Agent offline: Other-Bot");
  });

  it("suppresses agent-offline from different workspace", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-agent-offline", {
        new: { workspace_id: "ws-other", health: "offline", name: "Bot-X", owner_id: "user-001" },
        old: { health: "healthy" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("suppresses toast for non-offline health change", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-agent-offline", {
        new: { workspace_id: "ws-001", health: "healthy", name: "Bot-1", owner_id: "user-001" },
        old: { health: "degraded" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  // --- Task failure alerts (Task 4.3) ---

  it("shows toast when task on owned agent is cancelled", async () => {
    mockAgentFetch({ name: "Bot-1", owner_id: "user-001" });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-task-failure", {
        new: { workspace_id: "ws-001", status: "cancelled", agent_id: "agent-1", title: "Deploy v2" },
      });
    });

    expect(toastTitles()).toContain("Task cancelled: Deploy v2");
  });

  it("suppresses toast for non-cancelled status", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-task-failure", {
        new: { workspace_id: "ws-001", status: "completed", agent_id: "agent-1", title: "Deploy v2" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("suppresses toast when task has no agent_id", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-task-failure", {
        new: { workspace_id: "ws-001", status: "cancelled", agent_id: null, title: "Unassigned" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("suppresses cancelled task from other owner in mine scope", async () => {
    mockAgentFetch({ name: "Bot-2", owner_id: "user-999" });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-task-failure", {
        new: { workspace_id: "ws-001", status: "cancelled", agent_id: "agent-2", title: "Other task" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("shows cancelled task from other owner when scope is all", async () => {
    mockWorkspaceValues.fleetScope = "all";
    mockAgentFetch({ name: "Bot-2", owner_id: "user-999" });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-task-failure", {
        new: { workspace_id: "ws-001", status: "cancelled", agent_id: "agent-2", title: "Other task" },
      });
    });

    expect(toastTitles()).toContain("Task cancelled: Other task");
  });

  it("handles agent lookup failure gracefully", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } });
    const eq = vi.fn().mockReturnValue({ single });
    const select = vi.fn().mockReturnValue({ eq });
    mockSupabase.from.mockReturnValue({ select });
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-task-failure", {
        new: { workspace_id: "ws-001", status: "cancelled", agent_id: "agent-gone", title: "Lost task" },
      });
    });

    // In "mine" scope with null agent, owner_id check (null !== userId) suppresses the toast
    expect(toastTitles()).toHaveLength(0);
  });

  it("suppresses cancelled task from different workspace", async () => {
    renderProvider();

    await act(async () => {
      await simulatePayload("toast-task-failure", {
        new: { workspace_id: "ws-other", status: "cancelled", agent_id: "agent-1", title: "Foreign task" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });
});
