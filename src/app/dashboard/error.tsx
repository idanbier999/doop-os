"use client";

export default function DashboardError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="mac-window w-full max-w-sm">
        <div className="mac-title-bar">
          <div className="mac-close-box" />
          <span className="mac-title-bar-title">Dashboard Error</span>
        </div>
        <div className="p-6 bg-mac-white text-center">
          <p className="text-sm text-mac-dark-gray mb-4 font-[family-name:var(--font-pixel)]">
            Failed to load this page. Please try again.
          </p>
          <button
            onClick={reset}
            className="rounded-[6px] border border-mac-black bg-mac-black px-4 py-1.5 font-bold text-mac-white hover:bg-mac-dark-gray transition-colors font-[family-name:var(--font-pixel)]"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
  );
}
