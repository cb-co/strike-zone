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

  if (stats.length === 0) {
    return <p className="rounded-lg ring-1 ring-border bg-card px-4 py-12 text-center text-muted-foreground">No closed trades yet.</p>
  }

  return (
    <div className="rounded-lg ring-1 ring-border bg-card relative overflow-x-auto">
      <table className="data-table w-full text-[13px]">
        <thead className="border-b bg-muted/60">
          <tr>
            <th className="px-4 py-2.5 text-left">Setup</th>
            <th className="px-4 py-2.5 text-right">Trades</th>
            <th className="px-4 py-2.5 text-right">Win rate</th>
            <th className="px-4 py-2.5 text-right">Net P&amp;L</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {stats.map((s) => (
            <tr key={s.name} className="hover:bg-accent/60 transition-colors">
              <td className={`px-4 py-2.5 font-semibold ${s.name === 'Untagged' ? 'text-muted-foreground' : ''}`}>{s.name}</td>
              <td className="px-4 py-2.5 text-right text-muted-foreground">{s.count}</td>
              <td className="px-4 py-2.5 text-right">{s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0}%</td>
              <td className={`px-4 py-2.5 text-right font-semibold ${s.netPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                {s.netPnl > 0 ? '+' : ''}{formatCurrency(s.netPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
