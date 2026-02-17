export default function DashboardLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-40 rounded bg-mac-light-gray" />
        <div className="mt-2 h-4 w-64 rounded bg-mac-light-gray" />
      </div>

      {/* Stats bar skeleton */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-mac-border bg-mac-white px-4 py-3">
            <div className="h-3 w-20 rounded bg-mac-light-gray" />
            <div className="mt-2 h-7 w-12 rounded bg-mac-light-gray" />
          </div>
        ))}
      </div>

      {/* Pipeline skeleton */}
      <div>
        <div className="mb-3 h-6 w-32 rounded bg-mac-light-gray" />
        <div className="grid grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="rounded-lg border border-mac-border bg-mac-white/50">
              <div className="px-3 py-2">
                <div className="h-3 w-16 rounded bg-mac-light-gray" />
              </div>
              <div className="space-y-2 px-2 pb-3">
                <div className="h-16 rounded-lg bg-mac-light-gray/50" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity feed skeleton */}
      <div className="rounded-lg border border-mac-border bg-mac-white">
        <div className="border-b border-mac-border px-4 py-3">
          <div className="h-4 w-28 rounded bg-mac-light-gray" />
        </div>
        <div className="divide-y divide-mac-border">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-1 h-2 w-2 shrink-0 rounded-full bg-mac-light-gray" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-3/4 rounded bg-mac-light-gray" />
                <div className="h-3 w-16 rounded bg-mac-light-gray" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
