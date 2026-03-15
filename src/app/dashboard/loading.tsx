export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Fleet Stats Bar skeleton — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-lg border border-mac-border bg-mac-white px-4 py-3">
            <div className="h-3 w-20 rounded bg-mac-light-gray" />
            <div className="mt-2 h-7 w-12 rounded bg-mac-light-gray" />
          </div>
        ))}
      </div>

      {/* Agent Health Grid skeleton — full-width card-shaped placeholders */}
      <div className="rounded-lg border border-mac-border bg-mac-white">
        <div className="border-b border-mac-border px-4 py-3">
          <div className="h-4 w-24 rounded bg-mac-light-gray" />
        </div>
        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="rounded-lg border border-mac-border overflow-hidden">
              {/* Color band placeholder */}
              <div className="h-1.5 bg-mac-light-gray" />
              <div className="px-3 py-2.5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-24 rounded bg-mac-light-gray" />
                  <div className="h-5 w-12 rounded bg-mac-light-gray" />
                </div>
                <div className="h-3 w-32 rounded bg-mac-light-gray" />
                <div className="flex items-center justify-between">
                  <div className="h-3 w-12 rounded bg-mac-light-gray" />
                  <div className="h-6 w-20 rounded bg-mac-light-gray" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity Feed skeleton — full-width */}
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

      {/* Charts skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="rounded-lg border border-mac-border bg-mac-white">
            <div className="border-b border-mac-border px-4 py-3">
              <div className="h-4 w-36 rounded bg-mac-light-gray" />
            </div>
            <div className="p-4">
              <div className="h-[200px] rounded bg-mac-light-gray/30" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
