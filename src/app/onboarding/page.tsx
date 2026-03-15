import { redirect } from "next/navigation";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { signSupabaseToken } from "@/lib/jwt";
import { SupabaseTokenProvider } from "@/contexts/supabase-token-context";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const { user, supabase } = await getAuthenticatedSupabase();

  if (!user || !supabase) {
    redirect("/login");
  }

  // If user already has a workspace, skip onboarding
  const { data: membership } = await supabase
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- RPC name not in generated types yet
    .rpc("check_user_workspace_membership" as any)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  const supabaseToken = signSupabaseToken(user.id);

  return (
    <SupabaseTokenProvider token={supabaseToken}>
      <OnboardingWizard />
    </SupabaseTokenProvider>
  );
}
