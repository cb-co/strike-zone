'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  tab: string
  counts: { open: number; closed: number }
  children: React.ReactNode
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-20 ml-auto" />
      </div>
      <div className="rounded-lg ring-1 ring-border bg-card overflow-hidden">
        <div className="bg-muted/60 border-b px-3 py-2.5 flex gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-4 w-16" />)}
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="px-3 py-2 border-b flex gap-4">
            {Array.from({ length: 8 }).map((_, j) => <Skeleton key={j} className="h-4 w-16" />)}
          </div>
        ))}
      </div>
    </div>
  )
}

export function TradesTabsClient({ tab, counts, children }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const tabs = [
    { value: 'open', label: 'Open', count: counts.open },
    { value: 'closed', label: 'Closed', count: counts.closed },
    { value: 'calendar', label: 'Calendar' },
    { value: 'by-ticker', label: 'By Ticker' },
    { value: 'by-setups', label: 'Setups' },
  ]

  function switchTab(value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', value)
    params.set('page', '1')
    // preserve filter params; clear tab-specific ones
    startTransition(() => {
      router.push(`/trades?${params}`)
    })
  }

  return (
    <>
      <div role="tablist" aria-label="Trade views" className="flex w-fit max-w-full relative overflow-x-auto h-9 items-center rounded-md bg-card ring-1 ring-border p-[3px] gap-0.5">
        {tabs.map((t) => {
          const active = tab === t.value
          return (
            <button
              key={t.value}
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(t.value)}
              disabled={isPending}
              className={cn(
                'inline-flex h-full items-center gap-2 whitespace-nowrap rounded-sm px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-ring disabled:pointer-events-none',
                active
                  ? 'bg-sidebar text-sidebar-foreground'
                  : 'text-foreground/65 hover:text-foreground hover:bg-accent'
              )}
            >
              {t.label}
              {'count' in t && (
                <span
                  className={cn(
                    'min-w-5 px-1 rounded-sm text-[11px] leading-[18px] tabular-nums text-center',
                    active ? 'bg-white/20 text-sidebar-foreground' : 'bg-muted text-muted-foreground'
                  )}
                >
                  {t.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
      <div>{isPending ? <TableSkeleton /> : children}</div>
    </>
  )
}
