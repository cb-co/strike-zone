'use client'

import { useState } from 'react'
import { formatCurrency } from '@/lib/format'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowDown01Icon } from '@hugeicons/core-free-icons'

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

  const fmtDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' }) : '—'

  if (stats.length === 0) {
    return <p className="rounded-lg ring-1 ring-border bg-card px-4 py-12 text-center text-muted-foreground">No closed trades yet.</p>
  }

  return (
    <div className="rounded-lg ring-1 ring-border bg-card relative overflow-x-auto">
      <table className="data-table w-full text-[13px]">
        <thead className="border-b bg-muted/60">
          <tr>
            <th className="px-4 py-2.5 text-left">Ticker</th>
            <th className="px-4 py-2.5 text-right">Trades</th>
            <th className="px-4 py-2.5 text-right">Win rate</th>
            <th className="px-4 py-2.5 text-right">Net P&amp;L</th>
            <th className="px-4 py-2.5 text-right">Avg. days held</th>
            <th className="w-10"><span className="sr-only">Expand</span></th>
          </tr>
        </thead>
        {stats.map((s) => {
          const open = expanded.has(s.ticker)
          return (
            <tbody key={s.ticker} className="border-b last:border-b-0">
              <tr
                className="cursor-pointer hover:bg-accent/60 transition-colors"
                onClick={() => toggle(s.ticker)}
              >
                <td className="px-4 py-2.5">
                  <button
                    type="button"
                    aria-expanded={open}
                    className="font-mono text-[15px] font-semibold tracking-[0.02em] focus-visible:outline-2 focus-visible:outline-ring rounded-sm"
                  >
                    {s.ticker}
                  </button>
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{s.count}</td>
                <td className="px-4 py-2.5 text-right">{s.count > 0 ? Math.round((s.wins / s.count) * 100) : 0}%</td>
                <td className={`px-4 py-2.5 text-right font-semibold ${s.netPnl >= 0 ? 'text-gain' : 'text-loss'}`}>
                  {s.netPnl > 0 ? '+' : ''}{formatCurrency(s.netPnl)}
                </td>
                <td className="px-4 py-2.5 text-right text-muted-foreground">{s.avgDays}d</td>
                <td className="pr-3 text-right text-muted-foreground">
                  <HugeiconsIcon icon={ArrowDown01Icon} size={16} className={`inline transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
                </td>
              </tr>
              {open &&
                [...s.trades]
                  .sort((a, b) => {
                    const aDate = a.closeDate ? new Date(a.closeDate).getTime() : 0
                    const bDate = b.closeDate ? new Date(b.closeDate).getTime() : 0
                    return bDate - aDate
                  })
                  .map((t) => (
                    <tr key={t.id} className="bg-muted/40 text-[13px]">
                      <td className="pl-8 pr-4 py-1.5 text-muted-foreground" colSpan={3}>Closed {fmtDate(t.closeDate)}</td>
                      <td className={`px-4 py-1.5 text-right ${(t.netPnl ?? 0) >= 0 ? 'text-gain' : 'text-loss'}`}>
                        {(t.netPnl ?? 0) > 0 ? '+' : ''}{formatCurrency(t.netPnl ?? 0)}
                      </td>
                      <td colSpan={2} />
                    </tr>
                  ))}
            </tbody>
          )
        })}
      </table>
    </div>
  )
}
