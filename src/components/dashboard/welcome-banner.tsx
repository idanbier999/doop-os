"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";

export function WelcomeBanner() {
  return (
    <Card title="Welcome to Doop">
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-bold text-mac-black font-[family-name:var(--font-pixel)]">
            Your AI agent control plane is ready
          </h2>
          <p className="mt-1 text-sm text-mac-dark-gray">
            Doop helps teams and solos work with multiple AI agents — monitor health, tasks, and
            problems from one control plane.
          </p>
        </div>

        <ol className="space-y-2 text-sm text-mac-dark-gray">
          <li className="flex gap-2">
            <span className="font-bold text-mac-black font-[family-name:var(--font-pixel)]">
              1.
            </span>
            Go to Agents → Connect Agent
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-mac-black font-[family-name:var(--font-pixel)]">
              2.
            </span>
            Add API key to agent config
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-mac-black font-[family-name:var(--font-pixel)]">
              3.
            </span>
            Agent sends heartbeat → appears in fleet grid
          </li>
        </ol>

        <div className="flex gap-3">
          <Link
            href="/dashboard/agents"
            className="inline-flex items-center rounded-lg border border-mac-border-strong bg-mac-black px-4 py-1.5 text-sm font-bold text-mac-white hover:bg-mac-dark-gray transition-all duration-200 font-[family-name:var(--font-pixel)]"
          >
            Connect Agent
          </Link>
          <Link
            href="/dashboard/docs"
            className="inline-flex items-center rounded-lg border border-mac-border-strong bg-mac-white px-4 py-1.5 text-sm font-bold text-mac-black hover:bg-mac-highlight-soft transition-all duration-200 font-[family-name:var(--font-pixel)]"
          >
            API Quick Reference
          </Link>
        </div>
      </div>
    </Card>
  );
}
