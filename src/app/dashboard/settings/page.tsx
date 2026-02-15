import { createClient } from "@/lib/supabase/server";
import { SettingsPageClient } from "@/components/settings/settings-page-client";

export default async function SettingsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data: membership } = await supabase
    .rpc("check_user_workspace_membership" as any)
    .maybeSingle();

  if (!membership) return null;

  const { data: workspace } = await supabase
    .from("workspaces")
    .select("id, name, slug")
    .eq("id", (membership as any).workspace_id)
    .single();

  if (!workspace) return null;

  return (
    <SettingsPageClient
      workspace={workspace}
    />
  );
}
