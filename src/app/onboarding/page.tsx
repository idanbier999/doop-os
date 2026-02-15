import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { OnboardingWizard } from "@/components/onboarding/onboarding-wizard";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // If user already has a workspace, skip onboarding (RPC bypasses RLS cache issues)
  const { data: membership } = await supabase
    .rpc("check_user_workspace_membership" as any)
    .maybeSingle();

  if (membership) {
    redirect("/dashboard");
  }

  return <OnboardingWizard />;
}
