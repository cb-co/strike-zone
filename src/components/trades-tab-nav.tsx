import Link from 'next/link'
import { cn } from '@/lib/utils'

type Props = {
  tab: string
  perPage: number
  counts: { open: number; closed: number; losses: number }
}

export function TradesTabNav({ tab, perPage, counts }: Props) {
  const tabs = [
    { value: 'open', label: `Open (${counts.open})` },
    { value: 'closed', label: `Closed (${counts.closed})` },
    { value: 'calendar', label: 'Calendar' },
    { value: 'by-ticker', label: 'By Ticker' },
    { value: 'by-setups', label: 'Setups' },
    { value: 'losses', label: `Losses (${counts.losses})` },
  ]

  return (
    <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground">
      {tabs.map((t) => (
        <Link
          key={t.value}
          href={`/trades?tab=${t.value}&page=1&perPage=${perPage}`}
          className={cn(
            'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
            tab === t.value
              ? 'bg-background text-foreground shadow'
              : 'hover:bg-background/50 hover:text-foreground'
          )}
        >
          {t.label}
        </Link>
      ))}
    </div>
  )
}
