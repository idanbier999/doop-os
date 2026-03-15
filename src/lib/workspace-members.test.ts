import { vi, describe, it, expect } from "vitest";
import { createMockSupabaseClient, mockResolve } from "@/__tests__/mocks/supabase";
import { getWorkspaceMemberMap } from "./workspace-members";

describe("getWorkspaceMemberMap", () => {
  it("returns empty map when no members", async () => {
    const { client, chain } = createMockSupabaseClient();
    mockResolve(chain, []);

    const result = await getWorkspaceMemberMap(client as any, "ws-1");
    expect(result.size).toBe(0);
  });

  it("returns correct MemberInfo map", async () => {
    const { client, chain } = createMockSupabaseClient();
    mockResolve(chain, [
      {
        user_id: "u-1",
        role: "owner",
        user: { name: "Alice", email: "alice@example.com" },
      },
      {
        user_id: "u-2",
        role: "member",
        user: { name: "Bob", email: "bob@example.com" },
      },
    ]);

    const result = await getWorkspaceMemberMap(client as any, "ws-1");
    expect(result.size).toBe(2);
    expect(result.get("u-1")).toEqual({
      userId: "u-1",
      name: "Alice",
      email: "alice@example.com",
      role: "owner",
    });
    expect(result.get("u-2")).toEqual({
      userId: "u-2",
      name: "Bob",
      email: "bob@example.com",
      role: "member",
    });
  });

  it("handles missing user data with fallback to Unknown", async () => {
    const { client, chain } = createMockSupabaseClient();
    mockResolve(chain, [
      {
        user_id: "u-3",
        role: "member",
        user: null,
      },
    ]);

    const result = await getWorkspaceMemberMap(client as any, "ws-1");
    expect(result.get("u-3")).toEqual({
      userId: "u-3",
      name: "Unknown",
      email: "Unknown",
      role: "member",
    });
  });

  it("handles null data response", async () => {
    const { client, chain } = createMockSupabaseClient();
    // Default mockResolve with null data
    mockResolve(chain, null);

    const result = await getWorkspaceMemberMap(client as any, "ws-1");
    expect(result.size).toBe(0);
  });
});
