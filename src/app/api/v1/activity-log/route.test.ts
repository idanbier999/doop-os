import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockDb } from "@/__tests__/mocks/drizzle";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const mockAgent = {
  id: "agent-001",
  workspaceId: "ws-001",
  name: "test-agent",
};

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/api-auth", () => ({
  authenticateAgent: vi.fn(),
}));

vi.mock("@/lib/db/client", () => ({
  getDb: () => mockDb,
}));

vi.mock("@/lib/api-rate-limit", () => ({
  withRateLimit: (handler: Function) => handler,
}));

import { authenticateAgent } from "@/lib/api-auth";
import { POST } from "./route";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  reset();
  (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(mockAgent);
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("POST /api/v1/activity-log", () => {
  it("returns 401 when agent is not authenticated", async () => {
    (authenticateAgent as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid JSON", async () => {
    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{bad json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("returns 422 for missing action", async () => {
    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ details: { foo: "bar" } }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it("returns 422 for action exceeding max length", async () => {
    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "x".repeat(101) }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });

  it("returns 201 for valid action without details", async () => {
    // db.insert(activityLog) → success
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "agent_started" }),
    });

    const response = await POST(request);
    const json = await response.json();

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    // Verify insert was called
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("returns 201 for valid action with details", async () => {
    // db.insert(activityLog) → success
    pushResult([]);

    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "file_processed", details: { file: "test.csv", rows: 42 } }),
    });

    const response = await POST(request);
    expect(response.status).toBe(201);
  });

  it("returns 500 on database error", async () => {
    // db.insert(activityLog) → error
    pushError(new Error("DB error"));

    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(500);
  });

  it("returns 422 for unexpected fields", async () => {
    const request = new NextRequest("http://localhost/api/v1/activity-log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "test", evil: true }),
    });

    const response = await POST(request);
    expect(response.status).toBe(422);
  });
});
