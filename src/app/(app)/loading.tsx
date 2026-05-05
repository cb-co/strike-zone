export default function Loading() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-9 w-28 rounded-md bg-muted" />
      </div>
      <div className="rounded-md border">
        <div className="border-b bg-muted/50 px-4 py-3 flex gap-8">
          {[120, 80, 100, 80, 60, 80].map((w, i) => (
            <div key={i} className="h-4 rounded bg-muted" style={{ width: w }} />
          ))}
        </div>
        <div className="divide-y">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-4 py-3 flex gap-8">
              {[120, 80, 100, 80, 60, 80].map((w, j) => (
                <div key={j} className="h-4 rounded bg-muted/60" style={{ width: w }} />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
