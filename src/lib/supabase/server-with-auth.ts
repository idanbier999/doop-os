import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { createAuthenticatedClient } from "./authenticated";

/**
 * Gets the Better Auth session and returns an authenticated Supabase client.
 * Use this in Server Components, Server Actions, and Route Handlers.
 */
export async function getAuthenticatedSupabase() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session?.user) {
    return { session: null, supabase: null, user: null };
  }

  const supabase = createAuthenticatedClient(session.user.id);

  return {
    session,
    supabase,
    user: session.user,
  };
}
