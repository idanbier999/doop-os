import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import type { Database } from "@/lib/database.types";

/**
 * Creates a Supabase client authenticated as a specific user.
 * Signs a Supabase-compatible JWT with the Better Auth user ID,
 * making auth.uid() in Postgres return that user ID.
 */
export function createAuthenticatedClient(userId: string) {
  const token = jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.SUPABASE_JWT_SECRET!
  );

  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    }
  );
}
