export default function AgentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Status header skeleton */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 p-5">
        <div className="flex items-center gap-3">
          <div className="h-3 w-3 rounded-full bg-gray-800" />
          <div className="h-6 w-48 rounded bg-gray-800" />
        </div>
        <div className="mt-3 h-4 w-80 rounded bg-gray-800" />
        <div className="mt-4 flex gap-3">
          <div className="h-5 w-16 rounded-full bg-gray-800" />
          <div className="h-5 w-16 rounded-full bg-gray-800" />
          <div className="h-5 w-20 rounded-full bg-gray-800" />
        </div>
      </div>

      {/* Two column layout skeleton */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-6">
          {/* Timeline skeleton */}
          <div className="rounded-lg border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="h-4 w-20 rounded bg-gray-800" />
            </div>
            <div className="divide-y divide-gray-800">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-gray-800" />
                    <div className="h-5 w-16 rounded-full bg-gray-800" />
                  </div>
                  <div className="h-4 w-3/4 rounded bg-gray-800" />
                </div>
              ))}
            </div>
          </div>

          {/* Metadata skeleton */}
          <div className="rounded-lg border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="h-4 w-20 rounded bg-gray-800" />
            </div>
            <div className="px-4 py-4">
              <div className="space-y-1">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="h-4 rounded bg-gray-800" style={{ width: `${60 + i * 10}%` }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Problems skeleton */}
          <div className="rounded-lg border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="h-4 w-20 rounded bg-gray-800" />
            </div>
            <div className="divide-y divide-gray-800">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-5 w-14 rounded-full bg-gray-800" />
                    <div className="h-5 w-14 rounded-full bg-gray-800" />
                  </div>
                  <div className="h-4 w-2/3 rounded bg-gray-800" />
                </div>
              ))}
            </div>
          </div>

          {/* Tasks skeleton */}
          <div className="rounded-lg border border-gray-800 bg-gray-900">
            <div className="border-b border-gray-800 px-4 py-3">
              <div className="h-4 w-16 rounded bg-gray-800" />
            </div>
            <div className="divide-y divide-gray-800">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="px-4 py-3 space-y-2">
                  <div className="flex gap-2">
                    <div className="h-5 w-16 rounded-full bg-gray-800" />
                    <div className="h-5 w-14 rounded-full bg-gray-800" />
                  </div>
                  <div className="h-4 w-2/3 rounded bg-gray-800" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
