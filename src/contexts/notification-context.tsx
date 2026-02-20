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
  const { workspaceId } = useWorkspace();
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

  // Subscribe to Supabase Realtime for new problems
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

          // Only show toasts for high/critical problems
          if (problem.severity !== "high" && problem.severity !== "critical") {
            return;
          }

          // Fetch agent name and verify workspace ownership
          const { data: agent } = await supabase
            .from("agents")
            .select("name, workspace_id")
            .eq("id", problem.agent_id)
            .single();

          if (!agent || agent.workspace_id !== workspaceId) return;

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
  }, [supabase, workspaceId, addToast]);

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
