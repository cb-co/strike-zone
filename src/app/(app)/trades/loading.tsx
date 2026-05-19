import { Skeleton } from '@/components/ui/skeleton'

export default function TradesLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-7 w-28" />
          <Skeleton className="h-7 w-24" />
        </div>
      </div>
      <Skeleton className="h-9 w-80" />
      <div className="space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-7 w-64" />
        </div>
        <div className="rounded-md border overflow-hidden">
          <div className="bg-muted/50 border-b px-3 py-2 flex gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-4 w-16" />
            ))}
          </div>
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="px-3 py-2 border-b flex gap-4">
              {Array.from({ length: 8 }).map((_, j) => (
                <Skeleton key={j} className="h-4 w-16" />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-4 w-8" />
          <Skeleton className="h-7 w-14" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}
