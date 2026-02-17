import Link from "next/link";

export default function AgentNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-xl font-bold text-mac-black">Agent not found</h2>
      <p className="mt-2 text-sm text-mac-dark-gray">
        This agent may have been removed or the URL is incorrect.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-mac-highlight px-4 py-2 text-sm font-medium text-mac-highlight-text transition-colors hover:bg-mac-highlight-hover"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
