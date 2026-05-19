'use client'

import { formatCurrency } from '@/lib/format'

type ClosedTrade = {
  id: string
  netPnl: number | null
  tradeSetups: { setupId: string; setup: { name: string } }[]
}

type Props = { trades: ClosedTrade[] }

export function BySetupsTab({ trades }: Props) {
  type SetupStats = { name: string; count: number; wins: number; netPnl: number }
  const statsMap = new Map<string, SetupStats>()
  const untagged: SetupStats = { name: 'Untagged', count: 0, wins: 0, netPnl: 0 }

  for (const t of trades) {
    if (t.tradeSetups.length === 0) {
      untagged.count++
      if ((t.netPnl ?? 0) > 0) untagged.wins++
      untagged.netPnl += t.netPnl ?? 0
    }
    for (const ts of t.tradeSetups) {
      const existing = statsMap.get(ts.setupId) ?? { name: ts.setup.name, count: 0, wins: 0, netPnl: 0 }
      existing.count++
      if ((t.netPnl ?? 0) > 0) existing.wins++
      existing.netPnl += t.netPnl ?? 0
      statsMap.set(ts.setupId, existing)
    }
  }

  const stats = [...statsMap.values()]
  if (untagged.count > 0) stats.push(untagged)
  stats.sort((a, b) => b.netPnl - a.netPnl)

  return (
    <div className="rounded-md border divide-y">
      {stats.map((s) => (
        <div key={s.name} className="flex items-center justify-between px-4 py-3">
          <span className="font-medium w-36">{s.name}</span>
          <span className="text-sm text-muted-foreground w-24">{s.count} trades</span>
          <span className="text-sm w-24">{s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0}% win</span>
          <span className={`font-medium text-right ${s.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {s.netPnl > 0 ? '+' : ''}{formatCurrency(s.netPnl)}
          </span>
        </div>
      ))}
      {stats.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No closed trades</p>}
    </div>
  )
}
