"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";
import { useRealtimeEvents } from "@/hooks/use-realtime-events";
import { useWorkspace } from "@/contexts/workspace-context";
import { ToastContainer, type ToastData } from "@/components/ui/toast";

interface NotificationContextValue {
  addToast: (toast: Omit<ToastData, "id">) => void;
  dismissToast: (id: string) => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

const MAX_TOASTS = 3;

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const { workspaceId, userId, fleetScope } = useWorkspace();
  const counterRef = useRef(0);

  const addToast = useCallback((toast: Omit<ToastData, "id">) => {
    const id = `toast-${Date.now()}-${counterRef.current++}`;
    setToasts((prev) => {
      const next = [...prev, { ...toast, id }];
      if (next.length > MAX_TOASTS) {
        return next.slice(next.length - MAX_TOASTS);
      }
      return next;
    });
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Helper: check fleet scope ownership
  function isOwnedByUser(ownerId: string | null | undefined): boolean {
    if (fleetScope === "all") return true;
    return ownerId === userId;
  }

  // Listen to problems — toast on high/critical severity
  useRealtimeEvents({
    table: "problems",
    onEvent: (event) => {
      if (event.event !== "INSERT") return;
      const problem = event.new as
        | {
            severity: string;
            title: string;
            agent_id: string;
          }
        | undefined;
      if (!problem) return;
      if (problem.severity !== "high" && problem.severity !== "critical") return;

      addToast({
        type: problem.severity === "critical" ? "critical" : "warning",
        title: `Problem: ${problem.title}`,
        description: "New problem reported",
      });
    },
  });

  // Listen to agents — toast on offline transitions
  useRealtimeEvents({
    table: "agents",
    onEvent: (event) => {
      if (event.event !== "UPDATE") return;
      const agent = event.new as
        | {
            workspace_id?: string;
            workspaceId?: string;
            health: string;
            name: string;
            owner_id?: string | null;
            ownerId?: string | null;
          }
        | undefined;
      const old = event.old as { health?: string } | undefined;

      if (!agent) return;
      if (agent.health !== "offline") return;
      if (old?.health === "offline") return;
      if (!isOwnedByUser(agent.owner_id ?? agent.ownerId)) return;

      addToast({
        type: "warning",
        title: `Agent offline: ${agent.name}`,
        description: "No heartbeat received",
      });
    },
  });

  // Listen to tasks — toast on cancellations
  useRealtimeEvents({
    table: "tasks",
    onEvent: (event) => {
      if (event.event !== "UPDATE") return;
      const task = event.new as
        | {
            workspace_id?: string;
            workspaceId?: string;
            status: string;
            title: string;
            agent_id?: string | null;
          }
        | undefined;

      if (!task) return;
      if (task.status !== "cancelled") return;
      if (!task.agent_id) return;

      addToast({
        type: "critical",
        title: `Task cancelled: ${task.title}`,
        description: "Task was cancelled",
      });
    },
  });

  return (
    <NotificationContext.Provider value={{ addToast, dismissToast }}>
      {children}
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
