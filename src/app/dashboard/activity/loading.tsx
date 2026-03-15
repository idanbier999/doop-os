export default function ActivityLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-40 animate-pulse rounded-md bg-mac-light-gray" />
      <div className="flex gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-9 w-40 animate-pulse rounded-md bg-mac-light-gray" />
        ))}
      </div>
      <div className="rounded-lg border border-mac-border bg-mac-white divide-y divide-mac-border">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-3 px-4 py-3">
            <div className="h-5 w-5 animate-pulse rounded-full bg-mac-light-gray" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-48 animate-pulse rounded bg-mac-light-gray" />
              <div className="h-3 w-32 animate-pulse rounded bg-mac-light-gray" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
