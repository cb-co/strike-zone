'use client'

import { useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

type Props = {
  tab: string
  counts: { open: number; closed: number; losses: number }
  children: React.ReactNode
}

function TableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-8 w-20 ml-auto" />
      </div>
      <div className="rounded-md border overflow-hidden">
        <div className="bg-muted/50 border-b px-3 py-2 flex gap-4">
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
    { value: 'open', label: `Open (${counts.open})` },
    { value: 'closed', label: `Closed (${counts.closed})` },
    { value: 'calendar', label: 'Calendar' },
    { value: 'by-ticker', label: 'By Ticker' },
    { value: 'by-setups', label: 'Setups' },
    { value: 'losses', label: `Losses (${counts.losses})` },
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
      <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => switchTab(t.value)}
            disabled={isPending}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none',
              tab === t.value
                ? 'bg-background text-foreground shadow'
                : 'hover:bg-background/50 hover:text-foreground'
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div>{isPending ? <TableSkeleton /> : children}</div>
    </>
  )
}
