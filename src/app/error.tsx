"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-mac-cream">
      <div className="w-full max-w-md mac-window">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">Error</span>
        </div>
        <div className="p-6 bg-mac-white text-center">
          <p className="text-sm text-mac-dark-gray mb-4 font-[family-name:var(--font-pixel)]">
            Something went wrong. Please try again.
          </p>
          <button
            onClick={reset}
            className="rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
          >
            Try Again
          </button>
        </div>
      </div>
    </div>
  );
}
