'use client'

import { useState } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { MoreHorizontalIcon } from '@hugeicons/core-free-icons'
import { Flap, FlapStatus } from '@/components/flap'
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

export type BoardTotal = {
  label: string
  value: string
  tone?: 'ink' | 'gain' | 'loss' | 'yellow' | 'dim'
}

type Props = {
  positions: DashboardPosition[]
  totals: BoardTotal[]
  accounts: { id: string; name: string; optionAssignmentFee: number }[]
  setups: { id: string; name: string }[]
}

type Status = { label: string; kind: 'ontime' | 'due' | 'late' | 'hold' }

function statusOf(dte: number | null): Status {
  if (dte === null) return { label: 'Holding', kind: 'hold' }
  if (dte < 0) return { label: 'Expired', kind: 'late' }
  if (dte === 0) return { label: 'Today', kind: 'late' }
  if (dte <= 7) return { label: 'Due', kind: 'due' }
  return { label: 'On time', kind: 'ontime' }
}

function daysUntil(iso: string | null) {
  if (!iso) return null
  // Expirations are calendar dates stored at UTC midnight; compare whole days.
  const exp = new Date(iso)
  const now = new Date()
  const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((exp.getTime() - todayUtc) / 86_400_000)
}

/** A field that does not apply to this row posts a single dim dash. */
function Blank() {
  return <Flap value="—" tone="dim" />
}

function money(n: number, digits = 2) {
  const s = formatCurrency(n, { minimumFractionDigits: digits, maximumFractionDigits: digits })
  return n > 0 ? `+${s}` : s
}

function strikeText(n: number | null) {
  if (n == null) return ''
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0$/, '')
}

const TH = 'board-label font-normal px-1.5 pb-2 text-left whitespace-nowrap'
const TD = 'px-1.5 py-[3px] whitespace-nowrap'

export function DashboardOpenPositions({ positions, totals, accounts, setups }: Props) {
  const [editTrade, setEditTrade] = useState<DashboardPosition | null>(null)
  const [closingTrade, setClosingTrade] = useState<DashboardPosition | null>(null)
  const [rollingTrade, setRollingTrade] = useState<DashboardPosition | null>(null)
  const [deletingTrade, setDeletingTrade] = useState<DashboardPosition | null>(null)

  // A departure board runs in timetable order: soonest expiration first, stock last.
  const rows = [...positions]
    .map((t) => ({ t, dte: daysUntil(t.expiration) }))
    .sort((a, b) => (a.dte ?? Infinity) - (b.dte ?? Infinity))

  return (
    <>
      <section aria-labelledby="board-title" className="board overflow-hidden">
        {/* Board header */}
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 md:px-5 pt-4">
          <div className="flex items-baseline gap-3">
            <h2 id="board-title" className="font-heading text-[15px] font-semibold uppercase tracking-[0.1em] text-flap-yellow">
              Departures
            </h2>
            <span className="text-[12px] text-flap-dim">Open positions by expiration</span>
          </div>
          <span className="text-[12px] text-flap-dim tabular-nums">
            {positions.length} open
          </span>
        </div>

        {/* Totals line */}
        <dl className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-x-6 gap-y-4 px-4 md:px-5 pt-4 pb-5 border-b border-white/8">
          {totals.map((k, i) => (
            <div key={k.label} className="min-w-0">
              <dt className="board-label mb-1.5">{k.label}</dt>
              <dd>
                <Flap id={`total:${k.label}`} value={k.value} tone={k.tone ?? 'ink'} size="md" delay={i * 40} />
              </dd>
            </div>
          ))}
        </dl>

        {rows.length === 0 ? (
          <div className="px-4 md:px-5 py-8 space-y-3">
            <Flap value="No departures" tone="dim" />
            <p className="text-[13px] text-flap-dim max-w-md">
              Nothing is open on this account. Add a trade, or import a QFX file from the Trades page, and it will post here by expiration.
            </p>
          </div>
        ) : (
          <div className="relative overflow-x-auto px-2.5 md:px-3.5 pt-4 pb-4">
            <table className="w-full border-separate border-spacing-0">
              <thead>
                <tr>
                  <th className={TH}>Ticker</th>
                  <th className={cn(TH, 'hidden sm:table-cell')}>Type</th>
                  <th className={cn(TH, 'hidden md:table-cell')}>Strike</th>
                  <th className={cn(TH, 'hidden md:table-cell')}>Expires</th>
                  <th className={cn(TH, 'text-right')}>Days</th>
                  <th className={cn(TH, 'hidden lg:table-cell text-right')}>Qty</th>
                  <th className={cn(TH, 'hidden lg:table-cell text-right')}>Entry</th>
                  <th className={cn(TH, 'text-right')}>Proj.</th>
                  <th className={cn(TH, 'hidden sm:table-cell pl-5')}>Status</th>
                  <th className={TH}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ t, dte }, i) => {
                  const status = statusOf(dte)
                  const delay = Math.min(i, 8) * 20
                  const fid = (col: string) => `pos:${t.id}:${col}`
                  const isNext = dte !== null && rows.findIndex((r) => r.dte !== null) === i
                  const type = t.optionType ?? 'STK'
                  const exp = t.expiration
                    ? new Date(t.expiration).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: '2-digit' })
                    : ''
                  return (
                    <tr
                      key={t.id}
                      className={cn('group/row', isNext && '[&>td]:bg-white/[0.045] [&>td:first-child]:rounded-l-sm [&>td:last-child]:rounded-r-sm')}
                      title={`${isNext ? 'Next departure · ' : ''}${t.name} · ${t.symbol}`}
                    >
                      <td className={TD}>
                        <Flap id={fid('tk')} value={t.ticker} cells={5} delay={delay} tone={isNext ? 'yellow' : 'ink'} />
                      </td>
                      <td className={cn(TD, 'hidden sm:table-cell')}>
                        <Flap id={fid('ty')} value={`${t.side === 'SHORT' ? 'S' : 'L'} ${type}`} cells={6} tone={t.optionType ? 'ink' : 'dim'} delay={delay} />
                      </td>
                      <td className={cn(TD, 'hidden md:table-cell')}>
                        {t.strike == null ? <Blank /> : <Flap id={fid('st')} value={strikeText(t.strike)} cells={6} align="right" delay={delay} />}
                      </td>
                      <td className={cn(TD, 'hidden md:table-cell')}>
                        {exp ? <Flap id={fid('ex')} value={exp} cells={6} delay={delay} /> : <Blank />}
                      </td>
                      <td className={cn(TD, 'text-right')}>
                        {dte === null ? <Blank /> : (
                          <Flap
                            id={fid('dte')}
                            value={String(dte)}
                            cells={3}
                            align="right"
                            tone={status.kind === 'late' ? 'loss' : status.kind === 'due' ? 'yellow' : 'ink'}
                            delay={delay}
                          />
                        )}
                      </td>
                      <td className={cn(TD, 'hidden lg:table-cell text-right')}>
                        <Flap id={fid('q')} value={String(t.quantity)} cells={4} align="right" tone="dim" delay={delay} />
                      </td>
                      <td className={cn(TD, 'hidden lg:table-cell text-right')}>
                        <Flap id={fid('en')} value={formatCurrency(t.entryPrice)} cells={9} align="right" tone="dim" delay={delay} />
                      </td>
                      <td className={cn(TD, 'text-right')}>
                        {t.projectedProfit == null ? <Blank /> : (
                          <Flap
                            id={fid('pp')}
                            value={money(t.projectedProfit)}
                            cells={10}
                            align="right"
                            tone={t.projectedProfit >= 0 ? 'gain' : 'loss'}
                            delay={delay}
                          />
                        )}
                      </td>
                      <td className={cn(TD, 'hidden sm:table-cell pl-5')}>
                        <FlapStatus label={status.label} kind={status.kind} />
                      </td>
                      <td className={cn(TD, 'text-right w-8')}>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              type="button"
                              aria-label={`Actions for ${t.ticker}`}
                              className="grid place-items-center size-7 rounded-sm text-flap-dim hover:text-flap-ink hover:bg-flap focus-visible:outline-2 focus-visible:outline-flap-yellow transition-colors"
                            >
                              <HugeiconsIcon icon={MoreHorizontalIcon} size={18} />
                            </button>
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
            </table>
          </div>
        )}
      </section>

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
              className="bg-loss text-white hover:bg-loss/90"
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
