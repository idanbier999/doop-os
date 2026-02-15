export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded-md bg-gray-800" />
      <div className="flex gap-4 border-b border-gray-800 pb-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="h-5 w-20 animate-pulse rounded bg-gray-800"
          />
        ))}
      </div>
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-6 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-800" />
        <div className="space-y-3 max-w-md">
          <div className="h-10 animate-pulse rounded bg-gray-800" />
          <div className="h-10 animate-pulse rounded bg-gray-800" />
          <div className="h-9 w-32 animate-pulse rounded bg-gray-800" />
        </div>
      </div>
    </div>
  );
}
