export default function Loading() {
  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-8 animate-pulse" aria-busy="true" aria-label="Loading">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-md bg-muted" />
          <div className="h-7 w-40 rounded-sm bg-muted" />
        </div>
        <div className="h-8 w-28 rounded-md bg-muted" />
      </div>
      <div className="board h-72" />
      <div className="rounded-lg ring-1 ring-border bg-card">
        <div className="border-b bg-muted/60 px-4 py-3 flex gap-8">
          {[120, 80, 100, 80, 60, 80].map((w, i) => (
            <div key={i} className="h-3.5 rounded-sm bg-muted" style={{ width: w }} />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-8">
              {[120, 80, 100, 80, 60, 80].map((w, j) => (
                <div key={j} className="h-3.5 rounded-sm bg-muted/70" style={{ width: w }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
