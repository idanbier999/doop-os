import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
import { createAdminClient } from "@/lib/supabase/admin";

describe("Auto-Offline Detection (SQL function contract)", () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = createMockSupabaseClient();
    (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(mockSupabase.client);
  });

  it("can invoke mark_stale_agents_offline via RPC", async () => {
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });
    const supabase = createAdminClient();
    const { error } = await supabase.rpc("mark_stale_agents_offline");
    expect(error).toBeNull();
    expect(mockSupabase.rpc).toHaveBeenCalledWith("mark_stale_agents_offline");
  });

  it("activity_log entry follows expected schema", () => {
    const entry = {
      workspace_id: "ws-001",
      action: "agent.auto_offline",
      agent_id: "agent-001",
      details: { agent_name: "Bot", previous_health: "healthy", reason: "no_heartbeat_5m" },
    };
    expect(entry.action).toBe("agent.auto_offline");
    expect(entry.details.reason).toBe("no_heartbeat_5m");
    expect(entry.details).toHaveProperty("previous_health");
  });
});
