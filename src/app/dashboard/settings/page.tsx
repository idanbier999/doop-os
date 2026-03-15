import type { Metadata } from "next";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export const metadata: Metadata = { title: "Settings | Doop" };

export default async function SettingsPage() {
  const { user, supabase } = await getAuthenticatedSupabase();
  if (!user || !supabase) return null;

  const { data: membership } = await supabase
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", user.id)
    .limit(1)
    .single();

  if (!membership) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", membership.workspace_id)
    .single();

  if (!workspace) return null;

  return <SettingsPageClient workspace={workspace} />;
}
