export default function ProblemsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header skeleton */}
      <div>
        <div className="h-8 w-32 rounded bg-gray-800" />
        <div className="mt-2 h-4 w-72 rounded bg-gray-800" />
      </div>

      {/* Filters skeleton */}
      <div className="flex gap-3">
        <div className="h-10 w-40 rounded-md bg-gray-800" />
        <div className="h-10 w-44 rounded-md bg-gray-800" />
        <div className="h-10 w-40 rounded-md bg-gray-800" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-lg border border-gray-800 bg-gray-900 overflow-hidden">
        <div className="border-b border-gray-800">
          <div className="flex px-4 py-3 gap-4">
            {[80, 200, 120, 80, 100, 120].map((w, i) => (
              <div key={i} className="h-3 rounded bg-gray-800" style={{ width: w }} />
            ))}
          </div>
        </div>
        {[...Array(8)].map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b border-gray-800 px-4 py-3">
            <div className="h-5 w-16 rounded-full bg-gray-800" />
            <div className="h-4 flex-1 rounded bg-gray-800" />
            <div className="h-4 w-24 rounded bg-gray-800" />
            <div className="h-5 w-20 rounded-full bg-gray-800" />
            <div className="h-4 w-24 rounded bg-gray-800" />
            <div className="h-7 w-24 rounded bg-gray-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
