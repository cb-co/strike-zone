'use client'

import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { TradeForm, type TradeFormTrade } from '@/components/trade-form'
import { CloseTradeDialog } from '@/components/close-trade-dialog'
import { RollTradeDialog } from '@/components/roll-trade-dialog'

export type DashboardPosition = {
  id: string
  name: string
  ticker: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entryPrice: number
  quantity: number
  contractSize: number | null
  optionType: 'CALL' | 'PUT' | null
  strike: number | null
  expiration: string | null
  projectedProfit: number | null
  openDate: string
  accountId: string
  notes: string | null
  tradeSetups: { setupId: string }[]
}

type Props = {
  positions: DashboardPosition[]
  accounts: { id: string; name: string }[]
  setups: { id: string; name: string }[]
}

export function DashboardOpenPositions({ positions, accounts, setups }: Props) {
  const [editTrade, setEditTrade] = useState<DashboardPosition | null>(null)
  const [closingTrade, setClosingTrade] = useState<DashboardPosition | null>(null)
  const [rollingTrade, setRollingTrade] = useState<DashboardPosition | null>(null)

  if (positions.length === 0) {
    return <p className="text-xs text-muted-foreground">No open trades</p>
  }

  return (
    <>
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Ticker</th>
              <th className="px-3 py-2 text-left font-medium">Symbol</th>
              <th className="px-3 py-2 text-left font-medium">Side</th>
              <th className="px-3 py-2 text-right font-medium">Qty</th>
              <th className="px-3 py-2 text-right font-medium">Entry</th>
              <th className="px-3 py-2 text-right font-medium">Proj. Profit</th>
              <th className="px-3 py-2 text-right font-medium">Days Open</th>
              <th className="px-3 py-2 text-left font-medium">Expiration</th>
              <th className="px-3 py-2 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {positions.map((t) => {
              const daysOpen = Math.floor((Date.now() - new Date(t.openDate).getTime()) / 86_400_000)
              return (
              <tr key={t.id} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-mono font-medium">{t.ticker}</td>
                <td className="px-3 py-2 font-mono text-muted-foreground">{t.symbol}</td>
                <td className="px-3 py-2">
                  <Badge variant={t.side === 'LONG' ? 'default' : 'secondary'} className="text-xs px-1 py-0">
                    {t.side}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-right">{t.quantity}</td>
                <td className="px-3 py-2 text-right">${t.entryPrice.toFixed(2)}</td>
                <td className={cn(
                  'px-3 py-2 text-right',
                  t.projectedProfit != null
                    ? t.projectedProfit >= 0 ? 'text-green-600' : 'text-red-600'
                    : 'text-muted-foreground',
                )}>
                  {t.projectedProfit != null ? `$${t.projectedProfit.toFixed(0)}` : '—'}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">{daysOpen}d</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {t.expiration ? new Date(t.expiration).toLocaleDateString() : '—'}
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setEditTrade(t)}>Edit</Button>
                    <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setClosingTrade(t)}>Close</Button>
                    {t.optionType && (
                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs" onClick={() => setRollingTrade(t)}>Roll</Button>
                    )}
                  </div>
                </td>
              </tr>
            )})}

          </tbody>
        </table>
      </div>

      {editTrade && (
        <TradeForm
          key={editTrade.id}
          open={!!editTrade}
          onOpenChange={(o) => { if (!o) setEditTrade(null) }}
          accounts={accounts}
          setups={setups}
          trade={editTrade as unknown as TradeFormTrade}
        />
      )}

      {closingTrade && (
        <CloseTradeDialog
          key={`close-${closingTrade.id}`}
          open={!!closingTrade}
          onOpenChange={(o) => { if (!o) setClosingTrade(null) }}
          trade={{
            id: closingTrade.id,
            ticker: closingTrade.ticker,
            symbol: closingTrade.symbol,
            side: closingTrade.side,
            entryPrice: closingTrade.entryPrice,
            quantity: closingTrade.quantity,
            contractSize: closingTrade.contractSize,
            optionType: closingTrade.optionType,
            projectedProfit: closingTrade.projectedProfit,
          }}
        />
      )}

      {rollingTrade && (
        <RollTradeDialog
          key={`roll-${rollingTrade.id}`}
          open={!!rollingTrade}
          onOpenChange={(o) => { if (!o) setRollingTrade(null) }}
          trade={{
            id: rollingTrade.id,
            ticker: rollingTrade.ticker,
            symbol: rollingTrade.symbol,
            side: rollingTrade.side,
            entryPrice: rollingTrade.entryPrice,
            quantity: rollingTrade.quantity,
            contractSize: rollingTrade.contractSize,
            optionType: rollingTrade.optionType,
            strike: rollingTrade.strike,
            expiration: rollingTrade.expiration,
            projectedProfit: rollingTrade.projectedProfit,
          }}
        />
      )}
    </>
  )
}
