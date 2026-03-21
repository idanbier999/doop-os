import React from "react";
import { vi } from "vitest";

// Mock providers for testing components
function MockWorkspaceProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

// Setup context mocks
vi.mock("@/contexts/workspace-context", async () => {
  return {
    WorkspaceProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useWorkspace: vi.fn(() => ({
      workspaceId: "ws-001",
      userId: "user-001",
      userRole: "owner",
    })),
  };
});

export function TestProviders({ children }: { children: React.ReactNode }) {
  return <MockWorkspaceProvider>{children}</MockWorkspaceProvider>;
}
