import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { publicEnv } from "@/lib/env";

/**
 * Creates a browser Supabase client.
 * If a supabaseToken is provided, it will be used for RLS-authenticated queries.
 */
export function createClient(supabaseToken?: string) {
  return createSupabaseClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    supabaseToken
      ? {
          global: {
            headers: {
              Authorization: `Bearer ${supabaseToken}`,
            },
          },
        }
      : undefined
  );
}
