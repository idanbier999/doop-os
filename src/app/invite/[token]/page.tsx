import { getInviteDetails } from "@/app/dashboard/settings/team-actions";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AcceptInviteClient } from "@/components/invite/accept-invite-client";

export const metadata = { title: "Accept Invite | Tarely" };

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  // Validate invitation
  const result = await getInviteDetails(token);
  if (!result.success || !result.invitation) {
    return (
      <AcceptInviteClient
        token={token}
        invitation={null}
        error={result.error ?? "Invalid invitation"}
        isAuthenticated={false}
        isAlreadyMember={false}
      />
    );
  }

  // Check auth status
  const { user } = await getAuthenticatedSupabase();
  if (!user) {
    return (
      <AcceptInviteClient
        token={token}
        invitation={result.invitation}
        error={null}
        isAuthenticated={false}
        isAlreadyMember={false}
      />
    );
  }

  // Check if already a member (use admin client to bypass RLS)
  const adminClient = createAdminClient();
  const { data: existingMember } = await adminClient
    .from("workspace_members")
    .select("id")
    .eq("workspace_id", result.invitation.workspaceId)
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <AcceptInviteClient
      token={token}
      invitation={result.invitation}
      error={null}
      isAuthenticated={true}
      isAlreadyMember={!!existingMember}
    />
  );
}
