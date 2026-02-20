import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";

/**
 * Creates a browser Supabase client.
 * If a supabaseToken is provided, it will be used for RLS-authenticated queries.
 */
export function createClient(supabaseToken?: string) {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
