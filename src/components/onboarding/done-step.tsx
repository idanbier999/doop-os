"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function DoneStep() {
  const router = useRouter();

  return (
    <div className="space-y-6 text-center">
      <div>
        <svg
          className="mx-auto h-16 w-16 text-green-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div>
        <h2 className="text-xl font-semibold text-mac-black">
          You&apos;re all set
        </h2>
        <p className="mt-2 text-sm text-mac-gray">
          Your workspace is created and your first agent is registered. Head to the dashboard to monitor it.
        </p>
      </div>
      <Button onClick={() => router.push("/dashboard")} size="lg">
        Go to Dashboard
      </Button>
    </div>
  );
}
