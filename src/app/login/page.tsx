"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { getSafeRedirectUrl } from "@/lib/redirect-validation";
import { AuthForm } from "@/components/auth/auth-form";

function LoginInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = getSafeRedirectUrl(searchParams.get("redirect"));
  const { data: session } = authClient.useSession();

  useEffect(() => {
    if (session?.user) {
      router.replace(redirect);
    }
  }, [session, router, redirect]);

  return <AuthForm mode="login" redirectUrl={searchParams.get("redirect")} />;
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginInner />
    </Suspense>
  );
}
