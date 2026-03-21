import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockDb } from "@/__tests__/mocks/drizzle";

const { mockDb, pushResult, pushError, reset } = createMockDb();

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));

import { checkAndRecordRequest } from "./rate-limiter";

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("checkAndRecordRequest", () => {
  it("returns allowed=true when under the limit", async () => {
    // db.execute returns raw rows: [{ request_count: N }]
    pushResult([{ request_count: 5 }]);

    const result = await checkAndRecordRequest("agent-001", "minute", 60);

    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(5);
    expect(result.maxRequests).toBe(60);
    expect(result.retryAfterMs).toBeUndefined();
  });

  it("returns allowed=false with retryAfter when over the limit", async () => {
    pushResult([{ request_count: 61 }]);

    const result = await checkAndRecordRequest("agent-001", "minute", 60);

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(61);
    expect(result.maxRequests).toBe(60);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(60_000);
  });

  it("fails closed on DB error (returns allowed=false)", async () => {
    pushError(new Error("DB connection error"));

    const result = await checkAndRecordRequest("agent-001", "minute", 60);

    expect(result.allowed).toBe(false);
    expect(result.currentCount).toBe(0);
    expect(result.retryAfterMs).toBe(60_000);
  });

  it("calls db.execute with the upsert SQL", async () => {
    pushResult([{ request_count: 1 }]);

    await checkAndRecordRequest("agent-xyz", "hour", 1000);

    expect(mockDb.execute).toHaveBeenCalledTimes(1);
  });
});
