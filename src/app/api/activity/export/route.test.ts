import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabaseClient, mockResolve, mockReject } from "@/__tests__/mocks/supabase";
import { mockSession } from "@/__tests__/mocks/auth";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Map()),
}));

vi.mock("@/lib/auth", () => ({
  auth: {
    api: { getSession: vi.fn() },
  },
}));

const mockSupabase = createMockSupabaseClient();

vi.mock("@/lib/supabase/server-with-auth", () => ({
  getAuthenticatedSupabase: vi.fn(),
}));

import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { GET } from "./route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/activity/export");
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return new NextRequest(url, { method: "GET" });
}

function setupAuth(overrides?: Partial<{ user: unknown; supabase: unknown }>) {
  (getAuthenticatedSupabase as ReturnType<typeof vi.fn>).mockResolvedValue({
    user: mockSession.user,
    supabase: mockSupabase.client,
    session: mockSession,
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the mockSupabase.from to use the default chain
  mockSupabase.from.mockReturnValue(mockSupabase.chain);
  setupAuth();
});

// ---------------------------------------------------------------------------
// Tests — validation
// ---------------------------------------------------------------------------

describe("GET /api/activity/export", () => {
  it("returns 400 when workspace_id missing", async () => {
    const request = makeRequest({ format: "json" });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("workspace_id");
  });

  it("returns 400 when format missing", async () => {
    const request = makeRequest({ workspace_id: "ws-001" });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("format");
  });

  it("returns 400 when format is invalid (not csv/json)", async () => {
    const request = makeRequest({ workspace_id: "ws-001", format: "xml" });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Invalid format");
  });

  // --------------------------------------------------------------------------
  // Auth & authorization
  // --------------------------------------------------------------------------

  it("returns 401 when not authenticated", async () => {
    setupAuth({ user: null, supabase: null });

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(401);
    expect(json.error).toBe("Not authenticated");
  });

  it("returns 403 when not a workspace member", async () => {
    // membership check: returns null (no membership row)
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, null);

    mockSupabase.from.mockReturnValueOnce(memberChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(403);
    expect(json.error).toContain("Not authorized");
  });

  // --------------------------------------------------------------------------
  // Date validation
  // --------------------------------------------------------------------------

  it("returns 400 for invalid from date", async () => {
    // membership check: authorized
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { id: "m-1" });

    mockSupabase.from.mockReturnValueOnce(memberChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
      from: "not-a-date",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("from");
  });

  it("returns 400 for invalid to date", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { id: "m-1" });

    mockSupabase.from.mockReturnValueOnce(memberChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
      to: "not-a-date",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("to");
  });

  // --------------------------------------------------------------------------
  // Category validation
  // --------------------------------------------------------------------------

  it("returns 400 for unknown category", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { id: "m-1" });

    const activityChain = createMockSupabaseClient().chain;
    // The unknown category check happens before the query is executed,
    // so we still need the activity chain for the from() call.
    mockResolve(activityChain, []);

    mockSupabase.from.mockReturnValueOnce(memberChain).mockReturnValueOnce(activityChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
      category: "nonexistent_category",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Unknown category");
  });

  // --------------------------------------------------------------------------
  // Successful exports
  // --------------------------------------------------------------------------

  it("returns empty JSON export when no rows", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { id: "m-1" });

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, []);

    mockSupabase.from.mockReturnValueOnce(memberChain).mockReturnValueOnce(activityChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual([]);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Disposition")).toContain("attachment; filename=");
  });

  it("returns JSON export with proper headers", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { id: "m-1" });

    const rows = [
      {
        id: "a-1",
        action: "task_created",
        details: { task_name: "Build widget" },
        created_at: "2024-06-01T12:00:00Z",
        user_id: "user-001",
        workspace_id: "ws-001",
        agents: { name: "Agent Alpha" },
      },
    ];

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, rows);

    mockSupabase.from.mockReturnValueOnce(memberChain).mockReturnValueOnce(activityChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/json");
    expect(response.headers.get("Content-Disposition")).toContain(".json");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    expect(body).toHaveLength(1);
    expect(body[0].timestamp).toBe("2024-06-01T12:00:00Z");
    expect(body[0].agent_name).toBe("Agent Alpha");
    expect(body[0].action).toBe("task_created");
    expect(body[0].details).toContain("task_name");
  });

  it("returns CSV export with proper headers and content", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { id: "m-1" });

    const rows = [
      {
        id: "a-1",
        action: "task_created",
        details: { name: "Widget" },
        created_at: "2024-06-01T12:00:00Z",
        user_id: "user-001",
        workspace_id: "ws-001",
        agents: { name: "Agent Alpha" },
      },
    ];

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, rows);

    mockSupabase.from.mockReturnValueOnce(memberChain).mockReturnValueOnce(activityChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "csv",
    });

    const response = await GET(request);
    const text = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("Content-Disposition")).toContain(".csv");
    expect(response.headers.get("Cache-Control")).toBe("no-store");

    // CSV should have header row and one data row
    const lines = text.split("\r\n");
    expect(lines[0]).toBe("timestamp,agent_name,action,details,user");
    expect(lines.length).toBeGreaterThanOrEqual(2);
    expect(lines[1]).toContain("task_created");
    expect(lines[1]).toContain("Agent Alpha");
  });

  // --------------------------------------------------------------------------
  // Row limit
  // --------------------------------------------------------------------------

  it("returns 400 when too many results (>10000)", async () => {
    const memberChain = createMockSupabaseClient().chain;
    mockResolve(memberChain, { id: "m-1" });

    // Generate 10001 rows to trigger overflow
    const overflowRows = Array.from({ length: 10001 }, (_, i) => ({
      id: `a-${i}`,
      action: "task_created",
      details: null,
      created_at: "2024-06-01T12:00:00Z",
      user_id: "user-001",
      workspace_id: "ws-001",
      agents: null,
    }));

    const activityChain = createMockSupabaseClient().chain;
    mockResolve(activityChain, overflowRows);

    mockSupabase.from.mockReturnValueOnce(memberChain).mockReturnValueOnce(activityChain);

    const request = makeRequest({
      workspace_id: "ws-001",
      format: "json",
    });

    const response = await GET(request);
    const json = await response.json();

    expect(response.status).toBe(400);
    expect(json.error).toContain("Too many results");
  });
});
