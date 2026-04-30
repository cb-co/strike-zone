'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

type ClosedTrade = {
  id: string
  closeDate: Date | null
  netPnl: number | null
}

type Props = {
  trades: ClosedTrade[]
  month: number  // 1-12
  year: number
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month - 1, 1).getDay() // 0=Sun
}

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

export function CalendarTab({ trades, month, year }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(newMonth: number, newYear: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('month', String(newMonth))
    params.set('year', String(newYear))
    router.push(`?${params.toString()}`)
  }

  function prevMonth() {
    if (month === 1) navigate(12, year - 1)
    else navigate(month - 1, year)
  }

  function nextMonth() {
    if (month === 12) navigate(1, year + 1)
    else navigate(month + 1, year)
  }

  // Group trades by day
  const byDay = new Map<number, { total: number; count: number }>()
  for (const trade of trades) {
    if (!trade.closeDate || !trade.netPnl) continue
    const d = new Date(trade.closeDate)
    if (d.getMonth() + 1 !== month || d.getFullYear() !== year) continue
    const day = d.getDate()
    const existing = byDay.get(day) ?? { total: 0, count: 0 }
    byDay.set(day, { total: existing.total + trade.netPnl, count: existing.count + 1 })
  }

  const monthTotal = [...byDay.values()].reduce((sum, v) => sum + v.total, 0)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  // Pad to complete last week
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button onClick={prevMonth} className="px-3 py-1 rounded hover:bg-muted text-sm">← Prev</button>
        <div className="text-center">
          <span className="font-semibold">{MONTH_NAMES[month - 1]} {year}</span>
          <span className={cn('ml-3 text-sm font-medium', monthTotal >= 0 ? 'text-green-600' : 'text-red-600')}>
            {monthTotal >= 0 ? '+' : ''}${monthTotal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>
        <button onClick={nextMonth} className="px-3 py-1 rounded hover:bg-muted text-sm">Next →</button>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 gap-1">
        {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map((d) => (
          <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
        ))}
        {cells.map((day, i) => {
          if (!day) return <div key={i} />
          const data = byDay.get(day)
          return (
            <div
              key={i}
              className={cn(
                'min-h-16 rounded p-1 border text-xs',
                data
                  ? data.total >= 0
                    ? 'border-l-2 border-l-green-500 bg-green-50 dark:bg-green-950/20'
                    : 'border-l-2 border-l-red-500 bg-red-50 dark:bg-red-950/20'
                  : 'border-transparent'
              )}
            >
              <div className="text-muted-foreground">{day}</div>
              {data && (
                <>
                  <div className={cn('font-medium', data.total >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                    {data.total >= 0 ? '+' : ''}${Math.abs(data.total).toFixed(0)}
                  </div>
                  <div className="text-muted-foreground">{data.count} trade{data.count > 1 ? 's' : ''}</div>
                </>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
