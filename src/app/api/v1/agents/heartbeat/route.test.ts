import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import {
  createMockSupabaseClient,
  mockResolve,
  mockReject,
  createTableMocks,
} from "@/__tests__/mocks/supabase";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAgent = {
  id: "agent-001",
  workspace_id: "ws-001",
  name: "test-agent",
};

vi.mock("@/lib/api-auth", () => ({
  authenticateAgent: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

import { authenticateAgent } from "@/lib/api-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

beforeEach(() => {
  vi.clearAllMocks();
  mockSupabase = createMockSupabaseClient();
  (createAdminClient as ReturnType<typeof vi.fn>).mockReturnValue(
    mockSupabase.client
  );
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/agents/heartbeat", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const request = new NextRequest(
      "http://localhost/api/v1/agents/heartbeat",
      { method: "POST" }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Unauthorized");
  });

  it("returns { ok: true } for valid heartbeat with empty body", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/agents/heartbeat",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("updates last_seen_at and health to 'healthy'", async () => {
    const request = new NextRequest(
      "http://localhost/api/v1/agents/heartbeat",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    await POST(request);

    // from("agents") is called once (no metadata to merge) for the update
    expect(mockSupabase.from).toHaveBeenCalledWith("agents");
    expect(mockSupabase.chain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        last_seen_at: expect.any(String),
        health: "healthy",
      })
    );
  });

  it("merges version into metadata", async () => {
    // Set up two separate chains: one for the select (fetch existing metadata),
    // one for the update.
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { metadata: { existing: true } });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain) // first from("agents") -> select metadata
      .mockReturnValueOnce(updateChain); // second from("agents") -> update

    const request = new NextRequest(
      "http://localhost/api/v1/agents/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({ version: "2.0" }),
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(json.ok).toBe(true);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { existing: true, version: "2.0" },
      })
    );
  });

  it("merges meta into metadata", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, { metadata: { existing: true } });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/agents/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({ meta: { cpu: 42 } }),
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(json.ok).toBe(true);
    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { existing: true, meta: { cpu: 42 } },
      })
    );
  });

  it("preserves existing metadata when merging", async () => {
    const selectChain = createMockSupabaseClient().chain;
    mockResolve(selectChain, {
      metadata: { version: "1.0", custom: "keep-me" },
    });

    const updateChain = createMockSupabaseClient().chain;
    mockResolve(updateChain, null);

    mockSupabase.from
      .mockReturnValueOnce(selectChain)
      .mockReturnValueOnce(updateChain);

    const request = new NextRequest(
      "http://localhost/api/v1/agents/heartbeat",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer test-key",
        },
        body: JSON.stringify({ version: "2.0" }),
      }
    );

    await POST(request);

    expect(updateChain.update).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: { version: "2.0", custom: "keep-me" },
      })
    );
  });

  it("returns 500 on update error", async () => {
    // For a simple body (no metadata patch), only one from() call is needed for the update.
    mockReject(mockSupabase.chain, { message: "DB error" });

    const request = new NextRequest(
      "http://localhost/api/v1/agents/heartbeat",
      {
        method: "POST",
        headers: { Authorization: "Bearer test-key" },
      }
    );

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(500);
    expect(json.error).toBe("Failed to update heartbeat");
  });
});
