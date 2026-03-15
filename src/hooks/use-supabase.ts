"use client";

import { useMemo } from "react";
import { useSupabaseToken } from "@/contexts/supabase-token-context";
import { createClient } from "@/lib/supabase/client";

export function useSupabase() {
  const token = useSupabaseToken();
  return useMemo(() => createClient(token), [token]);
}
