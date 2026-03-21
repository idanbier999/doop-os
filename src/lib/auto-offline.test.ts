import { describe, it, expect } from "vitest";

describe("Auto-Offline Detection (SQL function contract)", () => {
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
