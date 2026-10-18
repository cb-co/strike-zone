'use client'

import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { ArrowLeft02Icon, ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { Flap } from '@/components/flap'

type Trade = {
  id: string
  closeDate: Date | string | null
  netPnl: number | null
}

type Props = {
  trades: Trade[]
  month: number // 1-12
  year: number
  onPrev: () => void
  onNext: () => void
  /** Called with YYYY-MM-DD when a day with closed trades is chosen. */
  onDay?: (date: string) => void
  cellHeight?: 'sm' | 'md'
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const GRID = { gridTemplateColumns: '2.25rem repeat(7, minmax(0, 1fr))' }

// ISO week number using the Monday of this calendar row (row 0 = first week of the grid).
// Using Sunday (the first cell) would give the wrong week number when that Sunday still
// belongs to the previous ISO week (ISO weeks run Mon–Sun).
function getISOWeek(year: number, month: number, firstDayOfMonth: number, rowIndex: number): number {
  const mondayDay = 1 - firstDayOfMonth + rowIndex * 7 + 1
  const d = new Date(Date.UTC(year, month - 1, mondayDay))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
}

function signed(n: number) {
  return `${n > 0 ? '+' : ''}${formatCurrency(n)}`
}

function compact(n: number) {
  const abs = Math.abs(n)
  const body = abs >= 1000 ? `${(abs / 1000).toFixed(abs >= 10_000 ? 0 : 1)}k` : abs.toFixed(0)
  return `${n < 0 ? '−' : '+'}${body}`
}

/**
 * Month grid of realised P&L. A day's weight follows its size: the biggest day
 * of the month reads loudest, small days stay quiet, so the month's shape shows
 * before any number is read.
 */
export function PnlCalendar({ trades, month, year, onPrev, onNext, onDay, cellHeight = 'md' }: Props) {
  const today = new Date()
  const todayDay = today.getDate()
  const todayMonth = today.getMonth() + 1
  const todayYear = today.getFullYear()

  const byDay = new Map<number, { total: number; count: number }>()
  for (const trade of trades) {
    if (!trade.closeDate) continue
    const d = new Date(trade.closeDate)
    if (d.getUTCMonth() + 1 !== month || d.getUTCFullYear() !== year) continue
    const day = d.getUTCDate()
    const existing = byDay.get(day) ?? { total: 0, count: 0 }
    byDay.set(day, { total: existing.total + (trade.netPnl ?? 0), count: existing.count + 1 })
  }

  const values = [...byDay.values()]
  const tradingDays = byDay.size
  const winDays = values.filter((v) => v.total > 0).length
  const monthTotal = values.reduce((sum, v) => sum + v.total, 0)
  const maxAbs = Math.max(1, ...values.map((v) => Math.abs(v.total)))

  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDay = new Date(year, month - 1, 1).getDay()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks: (number | null)[][] = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

  const mm = String(month).padStart(2, '0')
  const h = cellHeight === 'sm' ? 'h-20' : 'h-24'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex items-center gap-1">
          <button
            onClick={onPrev}
            aria-label="Previous month"
            className="grid place-items-center size-8 rounded-md text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
          </button>
          <button
            onClick={onNext}
            aria-label="Next month"
            className="grid place-items-center size-8 rounded-md text-foreground/70 hover:bg-accent hover:text-foreground transition-colors"
          >
            <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
          </button>
        </div>
        <h2 className="text-[17px] leading-tight font-semibold">
          {MONTH_NAMES[month - 1]} {year}
          <span className="font-medium text-muted-foreground"> realised P&amp;L</span>
        </h2>
        <div className="board flex items-center gap-3 px-2.5 py-1.5">
          <Flap
            value={signed(monthTotal)}
            tone={monthTotal > 0 ? 'gain' : monthTotal < 0 ? 'loss' : 'dim'}
          />
        </div>
        <span className="text-[13px] text-muted-foreground tabular-nums">
          {tradingDays > 0 ? `${winDays} of ${tradingDays} trading days green` : 'No closed trades this month'}
        </span>
      </div>

      <div className="rounded-lg ring-1 ring-border bg-card overflow-hidden">
        <div className="grid border-b bg-muted/60" style={GRID}>
          <div className="py-2 text-center sign-caps text-[10px] text-muted-foreground">Wk</div>
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center sign-caps text-[11px] text-muted-foreground">{d}</div>
          ))}
        </div>
        <div className="divide-y">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid divide-x" style={GRID}>
              <div className="flex items-start justify-center pt-2 text-[11px] font-medium text-muted-foreground tabular-nums bg-muted/40">
                {getISOWeek(year, month, firstDay, wi)}
              </div>
              {week.map((day, di) => {
                if (!day) return <div key={di} className={cn(h, 'bg-muted/40')} />
                const data = byDay.get(day)
                const isToday = day === todayDay && month === todayMonth && year === todayYear
                const weight = data ? Math.abs(data.total) / maxAbs : 0
                const up = data ? data.total >= 0 : false
                const date = `${year}-${mm}-${String(day).padStart(2, '0')}`
                const tint = data
                  ? { backgroundColor: `color-mix(in oklch, var(${up ? '--gain' : '--loss'}) ${Math.round(5 + weight * 13)}%, var(--card))` }
                  : undefined
                const content = (
                  <>
                    <span
                      className={cn(
                        'self-end grid place-items-center min-w-6 h-6 px-1 rounded-sm text-[12px] font-semibold tabular-nums',
                        isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
                      )}
                    >
                      {day}
                    </span>
                    {data && (
                      <span className="flex flex-col items-start text-left">
                        <span
                          className={cn('leading-none tabular-nums', up ? 'text-gain' : 'text-loss')}
                          style={{ fontSize: `${12 + weight * 6}px`, fontWeight: Math.round(500 + weight * 200) }}
                        >
                          <span className="sm:hidden">{compact(data.total)}</span>
                          <span className="hidden sm:inline">{signed(data.total)}</span>
                        </span>
                        <span className="hidden sm:block mt-1 text-[11px] text-muted-foreground">
                          {data.count} trade{data.count !== 1 ? 's' : ''}
                        </span>
                      </span>
                    )}
                  </>
                )
                return data && onDay ? (
                  <button
                    key={di}
                    type="button"
                    onClick={() => onDay(date)}
                    aria-label={`${MONTH_NAMES[month - 1]} ${day}: ${signed(data.total)}, ${data.count} trades. Show trades`}
                    className={cn(h, 'p-2 flex flex-col justify-between text-left transition-[filter] hover:brightness-[0.96] dark:hover:brightness-125 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring')}
                    style={tint}
                  >
                    {content}
                  </button>
                ) : (
                  <div key={di} className={cn(h, 'p-2 flex flex-col justify-between')} style={tint}>
                    {content}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
