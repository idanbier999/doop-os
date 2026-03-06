"use client";

import { createContext, useContext, useState, useMemo } from "react";

export type FleetScope = "mine" | "all";

interface WorkspaceContextValue {
  workspaceId: string;
  userId: string;
  userRole: string;
  fleetScope: FleetScope;
  setFleetScope: (scope: FleetScope) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspaceId,
  userId,
  userRole,
  children,
}: Omit<WorkspaceContextValue, "fleetScope" | "setFleetScope"> & { children: React.ReactNode }) {
  const [fleetScope, setFleetScope] = useState<FleetScope>("mine");

  const value = useMemo(() => ({
    workspaceId, userId, userRole, fleetScope, setFleetScope
  }), [workspaceId, userId, userRole, fleetScope]);

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
