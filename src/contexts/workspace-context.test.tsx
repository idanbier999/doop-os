import { renderHook } from "@testing-library/react";
import { WorkspaceProvider, useWorkspace } from "@/contexts/workspace-context";

describe("WorkspaceContext", () => {
  it("provides workspace context values to children", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <WorkspaceProvider workspaceId="ws-123" userId="user-456" userRole="admin">
        {children}
      </WorkspaceProvider>
    );

    const { result } = renderHook(() => useWorkspace(), { wrapper });

    expect(result.current).toMatchObject({
      workspaceId: "ws-123",
      userId: "user-456",
      userRole: "admin",
      fleetScope: "all",
    });
    expect(typeof result.current.setFleetScope).toBe("function");
  });

  it("useWorkspace throws when used outside provider", () => {
    // Suppress console.error for expected error
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});

    expect(() => {
      renderHook(() => useWorkspace());
    }).toThrow("useWorkspace must be used within a WorkspaceProvider");

    spy.mockRestore();
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
