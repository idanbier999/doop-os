"use client";

import { useEffect, useRef } from "react";

type ChangeEvent = {
  table: string;
  event: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, unknown>;
  old?: Record<string, unknown>;
  workspaceId: string;
};

interface UseRealtimeEventsOptions {
  table?: string;
  onEvent: (event: ChangeEvent) => void;
  enabled?: boolean;
}

const MAX_RECONNECT_DELAY_MS = 30_000;
const INITIAL_RECONNECT_DELAY_MS = 1_000;

export function useRealtimeEvents({ table, onEvent, enabled = true }: UseRealtimeEventsOptions) {
  const onEventRef = useRef(onEvent);
  const tableRef = useRef(table);

  useEffect(() => {
    onEventRef.current = onEvent;
  }, [onEvent]);

  useEffect(() => {
    tableRef.current = table;
  }, [table]);

  useEffect(() => {
    if (!enabled) return;

    let eventSource: EventSource | null = null;
    let reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    function connect() {
      if (disposed) return;

      eventSource = new EventSource("/api/events");

      eventSource.onopen = () => {
        // Reset backoff on successful connection
        reconnectDelay = INITIAL_RECONNECT_DELAY_MS;
      };

      eventSource.onmessage = (messageEvent) => {
        try {
          const event: ChangeEvent = JSON.parse(messageEvent.data);
          // Filter by table if specified
          if (tableRef.current && event.table !== tableRef.current) return;
          onEventRef.current(event);
        } catch {
          // Ignore malformed messages
        }
      };

      eventSource.onerror = () => {
        // Close the errored connection
        eventSource?.close();
        eventSource = null;

        if (disposed) return;

        // Reconnect with exponential backoff
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, reconnectDelay);

        reconnectDelay = Math.min(reconnectDelay * 2, MAX_RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [enabled]);
}

export type { ChangeEvent };
