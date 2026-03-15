import { redirect } from "next/navigation";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { signSupabaseToken } from "@/lib/jwt";
import { SupabaseTokenProvider } from "@/contexts/supabase-token-context";
import { WorkspaceProvider } from "@/contexts/workspace-context";
import { NotificationProvider } from "@/contexts/notification-context";
import { MobileSidebarProvider } from "@/contexts/mobile-sidebar-context";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
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

  // Generate JWT token for client-side Supabase access
  const supabaseToken = signSupabaseToken(user.id);

  return (
    <WorkspaceProvider
      workspaceId={workspace.id}
      userId={user.id}
      userRole={membership.role as "owner" | "admin" | "member"}
    >
      <SupabaseTokenProvider token={supabaseToken}>
        <NotificationProvider>
          <MobileSidebarProvider>
            <div className="flex h-screen overflow-hidden bg-mac-cream">
              <Sidebar userEmail={user.email || ""} workspaceName={workspace.name} />
              <div className="flex flex-1 flex-col overflow-hidden">
                <Header workspaceName={workspace.name} />
                <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-mac-cream">{children}</main>
              </div>
            </div>
          </MobileSidebarProvider>
        </NotificationProvider>
      </SupabaseTokenProvider>
    </WorkspaceProvider>
  );
}
