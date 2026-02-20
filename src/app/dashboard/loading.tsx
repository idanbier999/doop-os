export default function DashboardLoading() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* Fleet Stats Bar skeleton */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-lg border border-mac-border bg-mac-white px-4 py-3">
            <div className="h-3 w-20 rounded bg-mac-light-gray" />
            <div className="mt-2 h-7 w-12 rounded bg-mac-light-gray" />
          </div>
        ))}
      </div>

      {/* Agent Health Grid + Activity Feed skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2 rounded-lg border border-mac-border bg-mac-white">
          <div className="border-b border-mac-border px-4 py-3">
            <div className="h-4 w-24 rounded bg-mac-light-gray" />
          </div>
          <div className="p-4 space-y-4">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="h-5 w-28 rounded bg-mac-light-gray" />
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1">
                  {[...Array(3)].map((_, j) => (
                    <div key={j} className="flex items-center gap-2 p-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-mac-light-gray shrink-0" />
                      <div className="h-4 w-24 rounded bg-mac-light-gray" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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
