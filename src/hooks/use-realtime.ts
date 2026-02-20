"use client";

import { useEffect, useRef } from "react";
import { useSupabase } from "@/hooks/use-supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

type PostgresEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions {
  table: string;
  event?: PostgresEvent;
  filter?: string;
  schema?: string;
  onPayload: (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => void;
}

export function useRealtime({
  table,
  event = "*",
  filter,
  schema = "public",
  onPayload,
}: UseRealtimeOptions) {
  const supabase = useSupabase();
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {

    const channelConfig: {
      event: PostgresEvent;
      schema: string;
      table: string;
      filter?: string;
    } = {
      event,
      schema,
      table,
    };

    if (filter) {
      channelConfig.filter = filter;
    }

    const channel = supabase
      .channel(`realtime-${table}-${filter || "all"}`)
      .on("postgres_changes", channelConfig, onPayload)
      .subscribe();

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, table, event, filter, schema, onPayload]);

  return channelRef.current;
}
