import { redirect } from "next/navigation";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";

/**
 * Checks that the current user is authenticated and a member of a workspace.
 * Redirects to /login if unauthenticated or /onboarding if no workspace.
 * Returns the user, supabase client, workspace info, and role.
 */
export async function requireWorkspaceMembership() {
  const { user, supabase } = await getAuthenticatedSupabase();

  if (!user || !supabase) {
    redirect("/login");
  }

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id, role, workspaces(id, name, slug)")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership || !membership.workspaces) {
    redirect("/onboarding");
  }

  const workspace = membership.workspaces as unknown as {
    id: string;
    name: string;
    slug: string;
  };

  return {
    user,
    supabase,
    workspace,
    role: membership.role as "owner" | "admin" | "member",
  };
}
