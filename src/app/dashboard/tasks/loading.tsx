export default function TasksLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="h-8 w-32 animate-pulse rounded-md bg-gray-800" />
        <div className="flex gap-2">
          <div className="h-9 w-24 animate-pulse rounded-md bg-gray-800" />
          <div className="h-9 w-32 animate-pulse rounded-md bg-gray-800" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex-shrink-0 w-72 space-y-3">
            <div className="h-5 w-24 animate-pulse rounded-md bg-gray-800" />
            {Array.from({ length: 3 }).map((_, j) => (
              <div
                key={j}
                className="h-24 animate-pulse rounded-md bg-gray-800"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
