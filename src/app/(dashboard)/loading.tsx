export default function DashboardLoading() {
  return (
    <div className="min-h-screen bg-zinc-50">
      {/* Header skeleton */}
      <div className="sticky top-0 z-30 bg-white border-b border-zinc-200">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-zinc-200 rounded-lg animate-pulse" />
            <div className="h-4 w-28 bg-zinc-200 rounded animate-pulse" />
            <div className="h-3 w-3 bg-zinc-100 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-1">
            <div className="w-7 h-7 bg-zinc-100 rounded-lg animate-pulse" />
            <div className="w-7 h-7 bg-zinc-100 rounded-lg animate-pulse" />
            <div className="w-7 h-7 bg-zinc-100 rounded-lg animate-pulse" />
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-5 space-y-4">
        {/* Search bar skeleton */}
        <div className="h-10 bg-zinc-200 rounded-xl animate-pulse" />

        {/* Section title skeleton */}
        <div className="flex items-center justify-between">
          <div className="h-4 w-20 bg-zinc-200 rounded animate-pulse" />
          <div className="h-7 w-16 bg-zinc-100 rounded-lg animate-pulse" />
        </div>

        {/* Card skeletons */}
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="bg-white border border-zinc-200 rounded-2xl p-4 flex gap-3 animate-pulse"
            style={{ animationDelay: `${i * 80}ms` }}
          >
            <div className="flex-1 space-y-2 min-w-0">
              <div className="h-4 bg-zinc-200 rounded w-4/5" />
              <div className="h-3 bg-zinc-100 rounded w-2/5" />
              <div className="h-3 bg-zinc-100 rounded w-3/5" />
            </div>
            <div className="w-14 h-10 bg-zinc-200 rounded-lg flex-shrink-0" />
          </div>
        ))}
      </main>
    </div>
  );
}
