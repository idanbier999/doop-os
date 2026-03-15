export default function SettingsLoading() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-32 animate-pulse rounded-md bg-mac-light-gray" />
      <div className="flex gap-4 border-b border-mac-border pb-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-5 w-20 animate-pulse rounded bg-mac-light-gray" />
        ))}
      </div>
      <div className="rounded-lg border border-mac-border bg-mac-white p-6 space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-mac-light-gray" />
        <div className="space-y-3 max-w-md">
          <div className="h-10 animate-pulse rounded bg-mac-light-gray" />
          <div className="h-10 animate-pulse rounded bg-mac-light-gray" />
          <div className="h-9 w-32 animate-pulse rounded bg-mac-light-gray" />
        </div>
      </div>
    </div>
  );
}
