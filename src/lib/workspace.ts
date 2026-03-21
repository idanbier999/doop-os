import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { workspaceMembers, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * Checks that the current user is authenticated and a member of a workspace.
 * Redirects to /login if unauthenticated or /onboarding if no workspace.
 * Returns the user, workspace info, and role.
 */
export async function requireWorkspaceMembership() {
  const user = await getSession();

  if (!user) {
    redirect("/login");
  }

  const db = getDb();
  const result = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      workspaceName: workspaces.name,
      workspaceSlug: workspaces.slug,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, user.id))
    .limit(1);

  if (!result[0]) {
    redirect("/onboarding");
  }

  const membership = result[0];

  return {
    user,
    workspace: {
      id: membership.workspaceId,
      name: membership.workspaceName,
      slug: membership.workspaceSlug,
    },
    role: membership.role as "owner" | "admin" | "member",
  };
}
