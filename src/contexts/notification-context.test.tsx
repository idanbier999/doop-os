// @vitest-environment jsdom
import { render, screen, act } from "@testing-library/react";
import { vi, type Mock } from "vitest";

// Track the onEvent callbacks registered by useRealtimeEvents
type EventCallback = (event: {
  event: string;
  table: string;
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  workspaceId: string;
}) => void;

const registeredCallbacks: { table?: string; onEvent: EventCallback }[] = [];

vi.mock("@/hooks/use-realtime-events", () => ({
  useRealtimeEvents: vi.fn(({ table, onEvent }: { table?: string; onEvent: EventCallback }) => {
    registeredCallbacks.push({ table, onEvent });
  }),
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

// Helper to simulate an SSE event to a specific table
function simulateEvent(
  table: string,
  event: {
    event: string;
    new?: Record<string, unknown>;
    old?: Record<string, unknown>;
  }
) {
  for (const cb of registeredCallbacks) {
    if (cb.table === table) {
      cb.onEvent({
        ...event,
        table,
        workspaceId: "ws-001",
      });
    }
  }
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
    registeredCallbacks.length = 0;
    mockWorkspaceValues = {
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "mine",
      setFleetScope: vi.fn(),
    };
  });

  // --- Setup & Cleanup ---

  it("registers SSE event listeners for problems, agents, and tasks", () => {
    renderProvider();

    const tables = registeredCallbacks.map((cb) => cb.table);
    expect(tables).toContain("problems");
    expect(tables).toContain("agents");
    expect(tables).toContain("tasks");
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

  // --- Problem toast scoping ---

  it("shows toast for critical problem INSERT", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("problems", {
        event: "INSERT",
        new: { severity: "critical", title: "CPU overload", agent_id: "agent-1" },
      });
    });

    expect(toastTitles()).toContain("Problem: CPU overload");
  });

  it("shows toast for high-severity problem INSERT", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("problems", {
        event: "INSERT",
        new: { severity: "high", title: "Memory leak", agent_id: "agent-2" },
      });
    });

    expect(toastTitles()).toContain("Problem: Memory leak");
  });

  it("suppresses low-severity problems", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("problems", {
        event: "INSERT",
        new: { severity: "low", title: "Minor issue", agent_id: "agent-1" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("suppresses medium-severity problems", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("problems", {
        event: "INSERT",
        new: { severity: "medium", title: "Warning", agent_id: "agent-1" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  // --- Agent offline alerts ---

  it("shows toast when agent transitions to offline", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("agents", {
        event: "UPDATE",
        new: { health: "offline", name: "Bot-1", owner_id: "user-001" },
        old: { health: "healthy" },
      });
    });

    expect(toastTitles()).toContain("Agent offline: Bot-1");
  });

  it("suppresses toast when agent was already offline (no transition)", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("agents", {
        event: "UPDATE",
        new: { health: "offline", name: "Bot-1", owner_id: "user-001" },
        old: { health: "offline" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("suppresses agent-offline from other owner in mine scope", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("agents", {
        event: "UPDATE",
        new: { health: "offline", name: "Other-Bot", owner_id: "user-999" },
        old: { health: "healthy" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("shows agent-offline from other owner when scope is all", async () => {
    mockWorkspaceValues.fleetScope = "all";
    renderProvider();

    await act(async () => {
      simulateEvent("agents", {
        event: "UPDATE",
        new: { health: "offline", name: "Other-Bot", owner_id: "user-999" },
        old: { health: "healthy" },
      });
    });

    expect(toastTitles()).toContain("Agent offline: Other-Bot");
  });

  it("suppresses toast for non-offline health change", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("agents", {
        event: "UPDATE",
        new: { health: "healthy", name: "Bot-1", owner_id: "user-001" },
        old: { health: "degraded" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  // --- Task cancellation alerts ---

  it("shows toast when task is cancelled", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("tasks", {
        event: "UPDATE",
        new: {
          status: "cancelled",
          agent_id: "agent-1",
          title: "Deploy v2",
        },
      });
    });

    expect(toastTitles()).toContain("Task cancelled: Deploy v2");
  });

  it("suppresses toast for non-cancelled status", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("tasks", {
        event: "UPDATE",
        new: {
          status: "completed",
          agent_id: "agent-1",
          title: "Deploy v2",
        },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });

  it("suppresses toast when task has no agent_id", async () => {
    renderProvider();

    await act(async () => {
      simulateEvent("tasks", {
        event: "UPDATE",
        new: { status: "cancelled", agent_id: null, title: "Unassigned" },
      });
    });

    expect(toastTitles()).toHaveLength(0);
  });
});
