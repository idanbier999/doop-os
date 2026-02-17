"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { login } from "./actions";
import { createClient } from "@/lib/supabase/client";

function LoginForm() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  const handleGoogleSignIn = async () => {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-mac-cream">
      <div className="w-full max-w-md mac-window">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">Sign In</span>
        </div>
        <div className="p-6 bg-mac-white">
          <p className="text-sm text-mac-dark-gray mb-6 font-[family-name:var(--font-pixel)]">
            Sign in to your Mangistew account
          </p>

          {error && (
            <div className="mb-4 p-2 border border-[#CC0000] bg-mac-white text-[#CC0000] text-sm font-[family-name:var(--font-pixel)]">
              {error}
            </div>
          )}

          {message && (
            <div className="mb-4 p-2 border border-[#007700] bg-mac-white text-[#007700] text-sm font-[family-name:var(--font-pixel)]">
              {message}
            </div>
          )}

          <form action={login} className="space-y-4">
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
                className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
                placeholder="Your password"
              />
            </div>

            <button
              type="submit"
              className="w-full rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
            >
              Sign In
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
            onClick={handleGoogleSignIn}
            className="w-full rounded-[6px] border border-mac-black bg-mac-white px-4 py-1.5 font-bold text-mac-black hover:bg-mac-light-gray transition-colors font-[family-name:var(--font-pixel)]"
          >
            Sign in with Google
          </button>

          <p className="mt-6 text-center text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
            Don&apos;t have an account?{" "}
            <a href="/signup" className="text-mac-highlight underline hover:no-underline">
              Sign up
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
