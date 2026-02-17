export default function BoardDetailLoading() {
  return (
    <div className="space-y-5 animate-pulse">
      {/* Back link */}
      <div className="h-4 w-24 rounded bg-mac-light-gray" />

      {/* Color bar */}
      <div className="h-[6px] w-full rounded-t-sm bg-mac-light-gray" />

      {/* Title */}
      <div className="h-7 w-64 rounded bg-mac-light-gray" />

      {/* Stats */}
      <div className="h-4 w-48 rounded bg-mac-light-gray" />

      {/* Controls row */}
      <div className="flex items-center justify-between">
        <div className="h-9 w-40 rounded-[6px] border border-mac-gray bg-mac-light-gray" />
        <div className="h-9 w-28 rounded-[6px] border border-mac-gray bg-mac-light-gray" />
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="h-8 w-44 rounded-sm border border-mac-gray bg-mac-light-gray" />
        <div className="h-8 w-44 rounded-sm border border-mac-gray bg-mac-light-gray" />
        <div className="h-8 w-44 rounded-sm border border-mac-gray bg-mac-light-gray" />
      </div>

      {/* Kanban columns */}
      <div className="flex gap-4 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex-shrink-0 w-[280px]">
            {/* Column header */}
            <div className="border-2 border-mac-gray bg-mac-white mb-3">
              <div className="h-[3px] bg-mac-light-gray" />
              <div className="flex items-center justify-between px-3 py-2">
                <div className="h-4 w-20 rounded bg-mac-light-gray" />
                <div className="h-5 w-6 rounded-full bg-mac-light-gray" />
              </div>
            </div>
            {/* Cards */}
            <div className="space-y-2">
              {[...Array(i % 3 === 0 ? 3 : i % 3 === 1 ? 2 : 1)].map(
                (_, j) => (
                  <div
                    key={j}
                    className="rounded-sm border border-mac-gray bg-mac-white p-3"
                  >
                    <div className="h-4 w-full rounded bg-mac-light-gray mb-2" />
                    <div className="h-3 w-2/3 rounded bg-mac-light-gray mb-2" />
                    <div className="h-5 w-16 rounded bg-mac-light-gray" />
                  </div>
                )
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
