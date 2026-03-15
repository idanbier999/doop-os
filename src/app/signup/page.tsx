"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AuthForm } from "@/components/auth/auth-form";

function SignupInner() {
  const searchParams = useSearchParams();
  return <AuthForm mode="signup" redirectUrl={searchParams.get("redirect")} />;
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupInner />
    </Suspense>
  );
}
