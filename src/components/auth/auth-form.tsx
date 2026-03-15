"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { getSafeRedirectUrl } from "@/lib/redirect-validation";

interface AuthFormProps {
  mode: "login" | "signup";
  redirectUrl: string | null;
}

export function AuthForm({ mode, redirectUrl }: AuthFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const redirect = getSafeRedirectUrl(redirectUrl);

  const isLogin = mode === "login";
  const title = isLogin ? "Sign In" : "Create Account";
  const subtitle = isLogin ? "Sign in to your Doop account" : "Get started with Doop";
  const submitLabel = isLogin ? "Sign In" : "Sign Up";
  const loadingLabel = isLogin ? "Signing in..." : "Creating account...";
  const googleLabel = isLogin ? "Sign in with Google" : "Sign up with Google";
  const switchText = isLogin ? "Don't have an account?" : "Already have an account?";
  const switchLink = isLogin ? "/signup" : "/login";
  const switchLabel = isLogin ? "Sign up" : "Sign in";

  const handleGoogleAuth = async () => {
    await authClient.signIn.social({
      provider: "google",
      callbackURL: redirect,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    if (!isLogin) {
      const confirmPassword = formData.get("confirmPassword") as string;
      if (password !== confirmPassword) {
        setError("Passwords do not match");
        setLoading(false);
        return;
      }
    }

    const result = isLogin
      ? await authClient.signIn.email({ email, password })
      : await authClient.signUp.email({ email, password, name: email.split("@")[0] });

    if (result.error) {
      setError(result.error.message ?? `${submitLabel} failed`);
      setLoading(false);
    } else {
      window.location.href = redirect;
    }
  };

  const switchHref =
    redirect !== "/dashboard"
      ? `${switchLink}?redirect=${encodeURIComponent(redirect)}`
      : switchLink;

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-mac-cream">
      <div className="w-full max-w-md mac-window">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">{title}</span>
        </div>
        <div className="p-6 bg-mac-white">
          <p className="text-sm text-mac-dark-gray mb-6 font-[family-name:var(--font-pixel)]">
            {subtitle}
          </p>

          {error && (
            <div className="mb-4 p-2 border border-[#CC0000] bg-mac-white text-[#CC0000] text-sm font-[family-name:var(--font-pixel)]">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
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
                minLength={isLogin ? undefined : 8}
                className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
                placeholder={isLogin ? "Your password" : "At least 8 characters"}
              />
            </div>

            {!isLogin && (
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
                  minLength={8}
                  className="w-full rounded-[2px] border border-mac-black bg-mac-white px-2 py-1.5 text-sm text-mac-black placeholder-mac-gray shadow-[inset_1px_1px_0px_#555] focus:outline-none focus:ring-2 focus:ring-mac-black"
                  placeholder="Repeat your password"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)] disabled:opacity-50"
            >
              {loading ? loadingLabel : submitLabel}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-mac-gray" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-mac-white px-2 text-mac-dark-gray font-[family-name:var(--font-pixel)]">
                or
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGoogleAuth}
            className="w-full rounded-[6px] border border-mac-black bg-mac-white px-4 py-1.5 font-bold text-mac-black hover:bg-mac-light-gray transition-colors font-[family-name:var(--font-pixel)]"
          >
            {googleLabel}
          </button>

          <p className="mt-6 text-center text-sm text-mac-dark-gray font-[family-name:var(--font-pixel)]">
            {switchText}{" "}
            <a href={switchHref} className="text-mac-highlight underline hover:no-underline">
              {switchLabel}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
