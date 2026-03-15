-- Required for Supabase Realtime to include old row data in UPDATE payloads,
-- enabling offline transition detection (old.health vs new.health).
-- Trade-off: increases WAL size for agents table updates (heartbeats, health).
-- Acceptable at current scale (<500 agents/workspace).
ALTER TABLE public.agents REPLICA IDENTITY FULL;
