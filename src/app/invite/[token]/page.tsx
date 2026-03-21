import { getInviteDetails } from "@/app/dashboard/settings/team-actions";
import { getSession } from "@/lib/auth/session";
import { getDb } from "@/lib/db/client";
import { workspaceMembers } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { AcceptInviteClient } from "@/components/invite/accept-invite-client";

export const metadata = { title: "Accept Invite | Doop" };

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
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
  const user = await getSession();
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

  // Check if already a member
  const db = getDb();
  const [existingMember] = await db
    .select({ id: workspaceMembers.id })
    .from(workspaceMembers)
    .where(
      and(
        eq(workspaceMembers.workspaceId, result.invitation.workspaceId),
        eq(workspaceMembers.userId, user.id)
      )
    )
    .limit(1);

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
