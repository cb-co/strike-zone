'use client'

import { useState } from 'react'

type ClosedTrade = {
  id: string
  ticker: string
  netPnl: number | null
  openDate: Date
  closeDate: Date | null
}

type Props = { trades: ClosedTrade[] }

type TickerStats = {
  ticker: string
  count: number
  wins: number
  netPnl: number
  avgDays: number
  trades: ClosedTrade[]
}

export function ByTickerTab({ trades }: Props) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const statsMap = new Map<string, TickerStats>()
  for (const t of trades) {
    const existing = statsMap.get(t.ticker) ?? { ticker: t.ticker, count: 0, wins: 0, netPnl: 0, avgDays: 0, trades: [] }
    existing.count++
    if ((t.netPnl ?? 0) > 0) existing.wins++
    existing.netPnl += t.netPnl ?? 0
    if (t.closeDate) {
      existing.avgDays += Math.floor((new Date(t.closeDate).getTime() - new Date(t.openDate).getTime()) / 86_400_000)
    }
    existing.trades.push(t)
    statsMap.set(t.ticker, existing)
  }

  const stats = [...statsMap.values()].map((s) => ({ ...s, avgDays: s.count > 0 ? Math.round(s.avgDays / s.count) : 0 }))
  stats.sort((a, b) => b.netPnl - a.netPnl)

  function toggle(ticker: string) {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(ticker)) next.delete(ticker)
      else next.add(ticker)
      return next
    })
  }

  return (
    <div className="rounded-md border divide-y">
      {stats.map((s) => (
        <div key={s.ticker}>
          <div
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/30"
            onClick={() => toggle(s.ticker)}
          >
            <span className="font-mono font-medium w-24">{s.ticker}</span>
            <span className="text-sm text-muted-foreground w-24">{s.count} trades</span>
            <span className="text-sm w-24">{s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0}% win</span>
            <span className={`font-medium w-32 text-right ${s.netPnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {s.netPnl >= 0 ? '+' : ''}${s.netPnl.toFixed(2)}
            </span>
            <span className="text-sm text-muted-foreground w-20 text-right">{s.avgDays}d avg</span>
            <span className="ml-4 text-muted-foreground">{expanded.has(s.ticker) ? '▲' : '▼'}</span>
          </div>
          {expanded.has(s.ticker) && (
            <div className="bg-muted/20 px-4 py-2 space-y-1">
              {[...s.trades].sort((a, b) => {
                const aDate = a.closeDate ? new Date(a.closeDate).getTime() : 0
                const bDate = b.closeDate ? new Date(b.closeDate).getTime() : 0
                return bDate - aDate
              }).map((t) => (
                <div key={t.id} className="flex items-center gap-4 text-sm py-1">
                  <span className="text-muted-foreground w-24">{t.closeDate ? new Date(t.closeDate).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
                  <span className={`font-medium ${(t.netPnl ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(t.netPnl ?? 0) >= 0 ? '+' : ''}${(t.netPnl ?? 0).toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
      {stats.length === 0 && <p className="px-4 py-8 text-center text-sm text-muted-foreground">No closed trades</p>}
    </div>
  )
}
