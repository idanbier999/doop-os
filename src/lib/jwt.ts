import jwt from "jsonwebtoken";
import { env } from "@/lib/env";

/**
 * Signs a Supabase-compatible JWT for the given user ID.
 * The token is valid for 1 hour and uses the SUPABASE_JWT_SECRET env var.
 */
export function signSupabaseToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    env.SUPABASE_JWT_SECRET
  );
}
