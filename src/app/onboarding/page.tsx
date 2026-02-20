import { redirect } from "next/navigation";
import jwt from "jsonwebtoken";
import { getAuthenticatedSupabase } from "@/lib/supabase/server-with-auth";
import { SupabaseTokenProvider } from "@/contexts/supabase-token-context";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const { user, supabase } = await getAuthenticatedSupabase();

  if (!user || !supabase) {
    redirect("/login");
  }

  // If user already has a workspace, skip onboarding
  const { data: membership } = await supabase
    .rpc("check_user_workspace_membership" as any)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  const supabaseToken = jwt.sign(
    {
      sub: user.id,
      role: "authenticated",
      aud: "authenticated",
      iss: "supabase",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    process.env.SUPABASE_JWT_SECRET!
  );

  return (
    <SupabaseTokenProvider token={supabaseToken}>
      <OnboardingWizard />
    </SupabaseTokenProvider>
  );
}
