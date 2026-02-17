"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { signup } from "../login/actions";
import { createClient } from "@/lib/supabase/client";

function SignupForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const [clientError, setClientError] = useState<string | null>(null);

  const handleGoogleSignUp = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  function handleSubmit(formData: FormData) {
    const password = formData.get("password") as string;
    const confirmPassword = formData.get("confirmPassword") as string;

    if (password !== confirmPassword) {
      setClientError("Passwords do not match");
      return;
    }

    setClientError(null);
    signup(formData);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-mac-cream">
      <div className="w-full max-w-md mac-window">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">Create Account</span>
        </div>
        <div className="p-6 bg-mac-white">
          <p className="text-sm text-mac-dark-gray mb-6 font-[family-name:var(--font-pixel)]">
            Get started with Mangistew
          </p>

          {(error || clientError) && (
            <div className="mb-4 p-2 border border-[#CC0000] bg-mac-white text-[#CC0000] text-sm font-[family-name:var(--font-pixel)]">
              {clientError || error}
            </div>
          )}

          <form action={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
              >
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
              >
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                minLength={6}
                className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
                placeholder="At least 6 characters"
              />
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="block text-sm font-bold text-mac-black mb-1 font-[family-name:var(--font-pixel)]"
              >
                Confirm password
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                required
                minLength={6}
                className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
                placeholder="Repeat your password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
            >
              Sign Up
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-mac-gray" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-mac-white px-2 text-mac-dark-gray font-[family-name:var(--font-pixel)]">or</span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleSignUp}
            className="w-full rounded-[6px] border border-mac-black bg-mac-white px-4 py-1.5 font-bold text-mac-black hover:bg-mac-light-gray transition-colors font-[family-name:var(--font-pixel)]"
          >
            Sign up with Google
          </button>

          <p className="mt-6 text-center text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
            Already have an account?{" "}
            <a href="/login" className="text-mac-highlight underline hover:no-underline">
              Sign in
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}
