import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockDb } from "@/__tests__/mocks/drizzle";
import { getWorkspaceMemberMap } from "./workspace-members";

const { mockDb, pushResult, reset } = createMockDb();

vi.mock("@/lib/db/client", () => ({ getDb: () => mockDb }));

beforeEach(() => {
  vi.clearAllMocks();
  reset();
});

describe("getWorkspaceMemberMap", () => {
  it("returns empty map when no members", async () => {
    pushResult([]);

    const result = await getWorkspaceMemberMap("ws-1");
    expect(result.size).toBe(0);
  });

  it("returns correct MemberInfo map", async () => {
    pushResult([
      {
        userId: "u-1",
        role: "owner",
        userName: "Alice",
      },
      {
        userId: "u-2",
        role: "member",
        userName: "Bob",
      },
    ]);

    const result = await getWorkspaceMemberMap("ws-1");
    expect(result.size).toBe(2);
    expect(result.get("u-1")).toEqual({
      userId: "u-1",
      name: "Alice",
      role: "owner",
    });
    expect(result.get("u-2")).toEqual({
      userId: "u-2",
      name: "Bob",
      role: "member",
    });
  });
});
