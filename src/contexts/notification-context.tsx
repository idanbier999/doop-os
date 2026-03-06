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
      // Keep only the most recent MAX_TOASTS
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

  // Subscribe to Supabase Realtime for problems, agent-offline, and task-failure alerts.
  // All three channels are torn down and re-subscribed when fleetScope toggles,
  // which is intentional so that notifications immediately reflect the new scope.
  useEffect(() => {

    const problemsChannel = supabase
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

          // Only show toasts for high/critical problems
          if (problem.severity !== "high" && problem.severity !== "critical") {
            return;
          }

          // Fetch agent name and verify workspace ownership
          const { data: agent } = await supabase
            .from("agents")
            .select("name, workspace_id, owner_id")
            .eq("id", problem.agent_id)
            .single();

          if (!agent || agent.workspace_id !== workspaceId) return;
          if (fleetScope === "mine" && agent.owner_id !== userId) return;

          addToast({
            type: problem.severity === "critical" ? "critical" : "warning",
            title: `Problem: ${problem.title}`,
            description: `Reported by ${agent.name || "Unknown agent"}`,
          });
        }
      )
      .subscribe();

    const agentOfflineChannel = supabase
      .channel("toast-agent-offline")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "agents",
        },
        (payload) => {
          const newAgent = payload.new as {
            workspace_id: string;
            health: string;
            name: string;
            owner_id: string | null;
          };
          const oldAgent = payload.old as {
            health?: string;
          };

          if (newAgent.workspace_id !== workspaceId) return;
          if (newAgent.health !== "offline") return;
          // Skip if the agent was already offline (unless old health is unavailable)
          if (oldAgent.health === "offline") return;
          if (fleetScope === "mine" && newAgent.owner_id !== userId) return;

          addToast({
            type: "warning",
            title: `Agent offline: ${newAgent.name}`,
          });
        }
      )
      .subscribe();

    const taskFailureChannel = supabase
      .channel("toast-task-failure")
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
        },
        async (payload) => {
          const newTask = payload.new as {
            workspace_id: string;
            status: string;
            agent_id: string | null;
            title: string;
          };

          if (newTask.workspace_id !== workspaceId) return;
          if (newTask.status !== "cancelled") return;
          if (!newTask.agent_id) return;

          const { data: agent } = await supabase
            .from("agents")
            .select("name, owner_id")
            .eq("id", newTask.agent_id)
            .single();

          if (fleetScope === "mine" && agent?.owner_id !== userId) return;

          addToast({
            type: "warning",
            title: `Task cancelled: ${newTask.title}`,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(problemsChannel);
      supabase.removeChannel(agentOfflineChannel);
      supabase.removeChannel(taskFailureChannel);
    };
  }, [supabase, workspaceId, addToast, fleetScope, userId]);

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
