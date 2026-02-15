import Link from "next/link";

export default function AgentNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <h2 className="text-xl font-bold text-gray-100">Agent not found</h2>
      <p className="mt-2 text-sm text-gray-500">
        This agent may have been removed or the URL is incorrect.
      </p>
      <Link
        href="/dashboard"
        className="mt-6 rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-gray-200 transition-colors hover:bg-gray-700"
      >
        Back to Dashboard
      </Link>
    </div>
  );
}
