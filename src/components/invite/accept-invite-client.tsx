"use client";

import { useState } from "react";
import Link from "next/link";
import { acceptInvitation } from "@/app/dashboard/settings/team-actions";

interface AcceptInviteClientProps {
  token: string;
  invitation: {
    workspaceId: string;
    workspaceName: string;
    role: string;
    expiresAt: string;
  } | null;
  error: string | null;
  isAuthenticated: boolean;
  isAlreadyMember: boolean;
}

export function AcceptInviteClient({
  token,
  invitation,
  error,
  isAuthenticated,
  isAlreadyMember,
}: AcceptInviteClientProps) {
  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState<string | null>(null);

  const handleAccept = async () => {
    setAccepting(true);
    setAcceptError(null);
    const result = await acceptInvitation(token);
    if (result.success) {
      window.location.href = "/dashboard";
    } else {
      setAcceptError(result.error ?? "Failed to accept invitation");
      setAccepting(false);
    }
  };

  // State 1: Invalid / expired / revoked invitation
  if (!invitation) {
    return (
      <Shell title="Invitation Not Available">
        {error && (
          <div className="mb-4 p-2 border border-[#CC0000] bg-mac-white text-[#CC0000] text-sm font-[family-name:var(--font-pixel)]">
            {error}
          </div>
        )}
        <Link
          href="/"
          className="inline-block rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
        >
          Go Home
        </Link>
      </Shell>
    );
  }

  // State 2: Not authenticated
  if (!isAuthenticated) {
    return (
      <Shell title="You've Been Invited">
        <p className="text-sm text-mac-dark-gray mb-6 font-[family-name:var(--font-pixel)]">
          Join <strong>{invitation.workspaceName}</strong> as a <strong>{invitation.role}</strong>
        </p>
        <div className="space-y-3">
          <a
            href={`/login?redirect=/invite/${token}`}
            className="block w-full text-center rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
          >
            Sign In
          </a>
          <a
            href={`/signup?redirect=/invite/${token}`}
            className="block w-full text-center rounded-[6px] border border-mac-black bg-mac-white px-4 py-1.5 font-bold text-mac-black hover:bg-mac-light-gray transition-colors font-[family-name:var(--font-pixel)]"
          >
            Create Account
          </a>
        </div>
      </Shell>
    );
  }

  // State 3: Already a member
  if (isAlreadyMember) {
    return (
      <Shell title="Already a Member">
        <p className="text-sm text-mac-dark-gray mb-6 font-[family-name:var(--font-pixel)]">
          You&apos;re already a member of <strong>{invitation.workspaceName}</strong>
        </p>
        <a
          href="/dashboard"
          className="inline-block rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
        >
          Go to Dashboard
        </a>
      </Shell>
    );
  }

  // State 4: Ready to accept
  return (
    <Shell title="Accept Invitation">
      <p className="text-sm text-mac-dark-gray mb-6 font-[family-name:var(--font-pixel)]">
        Join <strong>{invitation.workspaceName}</strong> as a <strong>{invitation.role}</strong>
      </p>
      {acceptError && (
        <div className="mb-4 p-2 border border-[#CC0000] bg-mac-white text-[#CC0000] text-sm font-[family-name:var(--font-pixel)]">
          {acceptError}
        </div>
      )}
      <button
        onClick={handleAccept}
        disabled={accepting}
        className="w-full rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)] disabled:opacity-50"
      >
        {accepting ? "Accepting..." : "Accept Invite"}
      </button>
    </Shell>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-mac-cream">
      <div className="w-full max-w-md mac-window">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">Team Invitation</span>
        </div>
        <div className="p-6 bg-mac-white">
          <h1 className="text-lg font-bold text-mac-black mb-4 font-[family-name:var(--font-pixel)]">
            {title}
          </h1>
          {children}
        </div>
      </div>
    </div>
  );
}
