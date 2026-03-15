"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useSupabase } from "@/hooks/use-supabase";
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

  const supabase = useSupabase();

  // Helper: check fleet scope ownership
  function isOwnedByUser(ownerId: string | null | undefined): boolean {
    if (fleetScope === "all") return true;
    return ownerId === userId;
  }

  // Channel 1: New problems
  useEffect(() => {
    const channel = supabase
      .channel("toast-problems")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "problems",
        },
        async (payload) => {
          const problem = payload.new as {
            severity: string;
            title: string;
            agent_id: string;
          };

          if (problem.severity !== "high" && problem.severity !== "critical") {
            return;
          }

          const { data: agent } = await supabase
            .from("agents")
            .select("name, workspace_id, owner_id")
            .eq("id", problem.agent_id)
            .single();

          if (!agent || agent.workspace_id !== workspaceId) return;
          if (!isOwnedByUser(agent.owner_id)) return;

          addToast({
            type: problem.severity === "critical" ? "critical" : "warning",
            title: `Problem: ${problem.title}`,
            description: `Reported by ${agent.name || "Unknown agent"}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, workspaceId, userId, fleetScope, addToast]);

  // Channel 2: Agent offline transitions
  useEffect(() => {
    const channel = supabase
      .channel("toast-agent-offline")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
        },
        async (payload) => {
          const agent = payload.new as {
            workspace_id: string;
            health: string;
            name: string;
            owner_id: string | null;
          };
          const old = payload.old as { health?: string };

          if (agent.workspace_id !== workspaceId) return;
          if (agent.health !== "offline") return;
          if (old.health === "offline") return;
          if (!isOwnedByUser(agent.owner_id)) return;

          addToast({
            type: "warning",
            title: `Agent offline: ${agent.name}`,
            description: "No heartbeat received",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, workspaceId, userId, fleetScope, addToast]);

  // Channel 3: Task cancellations
  useEffect(() => {
    const channel = supabase
      .channel("toast-task-failure")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
        },
        async (payload) => {
          const task = payload.new as {
            workspace_id: string;
            status: string;
            agent_id: string | null;
            title: string;
          };

          if (task.workspace_id !== workspaceId) return;
          if (task.status !== "cancelled") return;
          if (!task.agent_id) return;

          const { data: agent } = await supabase
            .from("agents")
            .select("name, owner_id")
            .eq("id", task.agent_id)
            .single();

          if (!isOwnedByUser(agent?.owner_id)) return;

          addToast({
            type: "critical",
            title: `Task cancelled: ${task.title}`,
            description: `Agent: ${agent?.name || "Unknown"}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, workspaceId, userId, fleetScope, addToast]);

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
