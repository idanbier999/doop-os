"use client";

import { createContext, useContext, useState } from "react";

export type FleetScope = "all" | "mine";

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
}: {
  workspaceId: string;
  userId: string;
  userRole: string;
  children: React.ReactNode;
}) {
  const [fleetScope, setFleetScope] = useState<FleetScope>("all");
  return (
    <WorkspaceContext.Provider value={{ workspaceId, userId, userRole, fleetScope, setFleetScope }}>
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
