"use client";

import { useEffect, useState } from "react";

export interface ToastData {
  id: string;
  type: "info" | "warning" | "critical";
  title: string;
  description?: string;
}

const typeStyles: Record<ToastData["type"], string> = {
  info: "border-mac-highlight",
  warning: "border-severity-high",
  critical: "border-severity-critical",
};

const titleBarBg: Record<ToastData["type"], string> = {
  info: "bg-mac-highlight text-mac-highlight-text",
  warning: "bg-severity-high text-white",
  critical: "bg-severity-critical text-white",
};

export function Toast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Trigger enter animation on next frame
    const raf = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id);
    }, 5000);
    return () => clearTimeout(timer);
  }, [toast.id, onDismiss]);

  return (
    <div
      className={`
        mac-window glass-panel w-72 transition-all duration-300 ease-out
        ${typeStyles[toast.type]}
        ${visible ? "translate-x-0 opacity-100" : "translate-x-full opacity-0"}
      `}
    >
      {/* Title bar */}
      <div
        className={`
          flex items-center gap-2 px-2 py-1 border-b-2 border-mac-border
          font-[family-name:var(--font-pixel)] text-xs
          ${titleBarBg[toast.type]}
        `}
      >
        <button
          onClick={() => onDismiss(toast.id)}
          className="mac-close-box flex-shrink-0"
          aria-label="Dismiss notification"
        />
        <span className="truncate font-bold bg-transparent px-1">
          {toast.type === "critical" ? "CRITICAL" : toast.type === "warning" ? "WARNING" : "INFO"}
        </span>
      </div>

      {/* Content */}
      <div className="px-3 py-2">
        <p className="font-[family-name:var(--font-pixel)] text-sm text-mac-black leading-tight">
          {toast.title}
        </p>
        {toast.description && (
          <p className="font-[family-name:var(--font-pixel)] text-xs text-mac-dark-gray mt-1 leading-tight">
            {toast.description}
          </p>
        )}
      </div>
    </div>
  );
}

export function ToastContainer({
  toasts,
  onDismiss,
}: {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}
