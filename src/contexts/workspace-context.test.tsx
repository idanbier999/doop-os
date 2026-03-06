import { renderHook, act } from "@testing-library/react";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";

describe("WorkspaceContext", () => {
  it("provides workspace context values to children", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspaceProvider workspaceId="ws-123" userId="user-456" userRole="admin">
        {children}
      </WorkspaceProvider>
    );

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    expect(result.current.workspaceId).toBe("ws-123");
    expect(result.current.userId).toBe("user-456");
    expect(result.current.userRole).toBe("admin");
    expect(result.current.fleetScope).toBe("mine");
    expect(result.current.setFleetScope).toEqual(expect.any(Function));
  });

  it("useWorkspace throws when used outside provider", () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useWorkspace());
    }).toThrow("useWorkspace must be used within a WorkspaceProvider");

    spy.mockRestore();
  });

  it("defaults fleetScope to mine", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspaceProvider workspaceId="ws-123" userId="user-456" userRole="admin">
        {children}
      </WorkspaceProvider>
    );

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    expect(result.current.fleetScope).toBe("mine");
  });

  it("setFleetScope toggles scope", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspaceProvider workspaceId="ws-123" userId="user-456" userRole="admin">
        {children}
      </WorkspaceProvider>
    );

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    expect(result.current.fleetScope).toBe("mine");

    act(() => {
      result.current.setFleetScope("all");
    });

    expect(result.current.fleetScope).toBe("all");
  });

  it("returns correct workspaceId, userId, userRole", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspaceProvider workspaceId="test-ws" userId="test-user" userRole="member">
        {children}
      </WorkspaceProvider>
    );

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    expect(result.current.workspaceId).toBe("test-ws");
    expect(result.current.userId).toBe("test-user");
    expect(result.current.userRole).toBe("member");
  });
});
