'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { TradeForm, type TradeFormTrade } from '@/components/trade-form'
import { CloseTradeDialog } from '@/components/close-trade-dialog'
import { RollTradeDialog } from '@/components/roll-trade-dialog'
import { deleteTrade } from '@/actions/trades'

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
  projProfitTotal: number
  accounts: { id: string; name: string; optionAssignmentFee: number }[]
  setups: { id: string; name: string }[]
}

export function DashboardOpenPositions({ positions, projProfitTotal, accounts, setups }: Props) {
  const [editTrade, setEditTrade] = useState<DashboardPosition | null>(null)
  const [closingTrade, setClosingTrade] = useState<DashboardPosition | null>(null)
  const [rollingTrade, setRollingTrade] = useState<DashboardPosition | null>(null)
  const [deletingTrade, setDeletingTrade] = useState<DashboardPosition | null>(null)

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
              <th className="px-3 py-2 text-right font-medium w-10">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {positions.map((t) => {
              const daysOpen = Math.floor((Date.now() - new Date(t.openDate).getTime()) / 86_400_000)
              const dte = t.expiration
                ? Math.ceil((new Date(t.expiration).getTime() - Date.now()) / 86_400_000)
                : null
              return (
                <tr key={t.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-3 py-2 font-mono font-medium">{t.ticker}</td>
                  <td className="px-3 py-2 font-mono text-muted-foreground text-[11px]">{t.symbol}</td>
                  <td className="px-3 py-2">
                    <span className={cn(
                      'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
                      t.side === 'LONG'
                        ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                        : 'bg-rose-50 text-rose-700 ring-rose-200',
                    )}>
                      {t.side}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">{t.quantity}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(t.entryPrice)}</td>
                  <td className={cn(
                    'px-3 py-2 text-right tabular-nums',
                    t.projectedProfit != null
                      ? t.projectedProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'
                      : 'text-muted-foreground',
                  )}>
                    {t.projectedProfit != null ? formatCurrency(t.projectedProfit, { minimumFractionDigits: 0, maximumFractionDigits: 0 }) : '—'}
                  </td>
                  <td className="px-3 py-2 text-right text-muted-foreground tabular-nums">{daysOpen}d</td>
                  <td className={cn(
                    'px-3 py-2 tabular-nums',
                    dte !== null && dte <= 0 ? 'text-rose-600 font-medium' :
                    dte !== null && dte <= 7 ? 'text-amber-600 font-medium' :
                    'text-muted-foreground',
                  )}>
                    {t.expiration ? new Date(t.expiration).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric' }) : '—'}
                    {dte !== null && dte <= 7 && dte > 0 && <span className="ml-1 text-[10px]">({dte}d)</span>}
                    {dte !== null && dte <= 0 && <span className="ml-1 text-[10px]">(exp)</span>}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-xs">···</Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setEditTrade(t)}>Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setClosingTrade(t)}>Close</DropdownMenuItem>
                        {t.optionType && (
                          <DropdownMenuItem onClick={() => setRollingTrade(t)}>Roll</DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem variant="destructive" onClick={() => setDeletingTrade(t)}>Delete</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t bg-muted/30">
            <tr>
              <td colSpan={5} className="px-3 py-2 text-right text-xs font-medium text-muted-foreground">Total Proj. Profit</td>
              <td className="px-3 py-2 text-right text-xs font-medium">
                <span className={projProfitTotal >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                  {formatCurrency(projProfitTotal, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </td>
              <td colSpan={3}></td>
            </tr>
          </tfoot>
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
          assignmentFee={accounts.find(a => a.id === closingTrade.accountId)?.optionAssignmentFee ?? 0}
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

      <AlertDialog open={!!deletingTrade} onOpenChange={(o) => { if (!o) setDeletingTrade(null) }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete trade?</AlertDialogTitle>
            <AlertDialogDescription>
              {deletingTrade
                ? `This will permanently delete "${deletingTrade.name}" (${deletingTrade.ticker}). This action cannot be undone.`
                : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (deletingTrade) await deleteTrade(deletingTrade.id)
                setDeletingTrade(null)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
