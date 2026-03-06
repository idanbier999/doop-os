import React from "react";
import { vi } from "vitest";

// Mock providers for testing components
function MockWorkspaceProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function MockSupabaseTokenProvider({ children }: { children: React.ReactNode }) {
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
      fleetScope: "mine",
      setFleetScope: vi.fn(),
    })),
  };
});

vi.mock("@/contexts/supabase-token-context", async () => {
  return {
    SupabaseTokenProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    useSupabaseToken: vi.fn(() => "test-token"),
  };
});

export function TestProviders({ children }: { children: React.ReactNode }) {
  return (
    <MockWorkspaceProvider>
      <MockSupabaseTokenProvider>{children}</MockSupabaseTokenProvider>
    </MockWorkspaceProvider>
  );
}
