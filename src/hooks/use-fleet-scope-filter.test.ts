// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";

// Must mock before imports
const mockUseWorkspace = vi.fn();
vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: (...args: unknown[]) => mockUseWorkspace(...args),
}));

import { useFleetScopeFilter, useOwnedAgentIds } from "./use-fleet-scope-filter";

describe("useFleetScopeFilter", () => {
  const items = [
    { id: "1", owner_id: "user-001" },
    { id: "2", owner_id: "user-002" },
    { id: "3", owner_id: null },
  ];

  beforeEach(() => {
    mockUseWorkspace.mockReturnValue({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "all",
      setFleetScope: vi.fn(),
    });
  });

  it("returns all items when scope is all", () => {
    const { result } = renderHook(() => useFleetScopeFilter(items));
    expect(result.current).toHaveLength(3);
  });

  it("filters by owner_id when scope is mine", () => {
    mockUseWorkspace.mockReturnValue({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "mine",
      setFleetScope: vi.fn(),
    });
    const { result } = renderHook(() => useFleetScopeFilter(items));
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("1");
  });

  it("excludes items with owner_id null when scope is mine", () => {
    mockUseWorkspace.mockReturnValue({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "mine",
      setFleetScope: vi.fn(),
    });
    const { result } = renderHook(() => useFleetScopeFilter(items));
    expect(result.current.every((i) => i.owner_id !== null)).toBe(true);
  });
});

describe("useOwnedAgentIds", () => {
  const agents = [
    { id: "a1", owner_id: "user-001" },
    { id: "a2", owner_id: "user-002" },
    { id: "a3", owner_id: null },
  ];

  beforeEach(() => {
    mockUseWorkspace.mockReturnValue({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "all",
      setFleetScope: vi.fn(),
    });
  });

  it("returns all IDs when scope is all", () => {
    const { result } = renderHook(() => useOwnedAgentIds(agents));
    expect(result.current.size).toBe(3);
  });

  it("returns only matching IDs when scope is mine", () => {
    mockUseWorkspace.mockReturnValue({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
      fleetScope: "mine",
      setFleetScope: vi.fn(),
    });
    const { result } = renderHook(() => useOwnedAgentIds(agents));
    expect(result.current.size).toBe(1);
    expect(result.current.has("a1")).toBe(true);
  });
});
