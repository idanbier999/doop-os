import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { env } from "@/lib/env";
import { signSupabaseToken } from "@/lib/jwt";

/**
 * Creates a Supabase client authenticated as a specific user.
 * Signs a Supabase-compatible JWT with the Better Auth user ID,
 * making auth.uid() in Postgres return that user ID.
 */
export function createAuthenticatedClient(userId: string) {
  const token = signSupabaseToken(userId);

  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
}
