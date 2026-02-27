import { renderHook } from "@testing-library/react";
import { useRealtime } from "@/hooks/use-realtime";

const mockChannel = {
  on: vi.fn().mockReturnThis(),
  subscribe: vi.fn().mockReturnThis(),
  unsubscribe: vi.fn(),
};

const mockSupabase = {
  channel: vi.fn(() => mockChannel),
  removeChannel: vi.fn(),
};

vi.mock("@/hooks/use-supabase", () => ({
  useSupabase: vi.fn(() => mockSupabase),
}));

describe("useRealtime", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("subscribes to realtime channel on mount", () => {
    const onPayload = vi.fn();

    renderHook(() =>
      useRealtime({ table: "tasks", onPayload })
    );

    expect(mockSupabase.channel).toHaveBeenCalled();
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ table: "tasks", event: "*", schema: "public" }),
      onPayload
    );
    expect(mockChannel.subscribe).toHaveBeenCalled();
  });

  it("calls supabase.channel with correct channel name", () => {
    const onPayload = vi.fn();

    renderHook(() =>
      useRealtime({ table: "agents", onPayload })
    );

    expect(mockSupabase.channel).toHaveBeenCalledWith("realtime-agents-all");
  });

  it("passes filter to channel config when provided", () => {
    const onPayload = vi.fn();

    renderHook(() =>
      useRealtime({
        table: "tasks",
        filter: "workspace_id=eq.ws-001",
        onPayload,
      })
    );

    expect(mockSupabase.channel).toHaveBeenCalledWith(
      "realtime-tasks-workspace_id=eq.ws-001"
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      "postgres_changes",
      expect.objectContaining({ filter: "workspace_id=eq.ws-001" }),
      onPayload
    );
  });

  it("cleans up channel on unmount (calls removeChannel)", () => {
    const onPayload = vi.fn();

    const { unmount } = renderHook(() =>
      useRealtime({ table: "tasks", onPayload })
    );

    unmount();

    expect(mockSupabase.removeChannel).toHaveBeenCalledWith(mockChannel);
  });
});
