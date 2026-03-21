import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { workspaceMembers, workspaces } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { MobileSidebarProvider } from "@/contexts/mobile-sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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
  const workspace = {
    id: membership.workspaceId,
    name: membership.workspaceName,
    slug: membership.workspaceSlug,
  };

  return (
    <WorkspaceProvider
      workspaceId={workspace.id}
      userId={user.id}
      userRole={membership.role as "owner" | "admin" | "member"}
    >
      <NotificationProvider>
        <MobileSidebarProvider>
          <div className="flex h-screen overflow-hidden bg-mac-cream">
            <Sidebar userName={user.name} workspaceName={workspace.name} />
            <div className="flex flex-1 flex-col overflow-hidden">
              <Header workspaceName={workspace.name} />
              <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-mac-cream">{children}</main>
            </div>
          </div>
        </MobileSidebarProvider>
      </NotificationProvider>
    </WorkspaceProvider>
  );
}
