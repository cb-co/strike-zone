'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import { ArrowLeft02Icon, ArrowRight02Icon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'

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
const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function fmt(n: number) {
  return Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

export function CalendarTab({ trades, month, year }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const today = new Date()
  const todayDay = today.getDate()
  const todayMonth = today.getMonth() + 1
  const todayYear = today.getFullYear()

  function navigate(newMonth: number, newYear: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'calendar')
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
    if (!trade.closeDate) continue
    const d = new Date(trade.closeDate)
    if (d.getMonth() + 1 !== month || d.getFullYear() !== year) continue
    const day = d.getDate()
    const existing = byDay.get(day) ?? { total: 0, count: 0 }
    byDay.set(day, { total: existing.total + (trade.netPnl ?? 0), count: existing.count + 1 })
  }

  const tradingDays = byDay.size
  const winDays = [...byDay.values()].filter((v) => v.total > 0).length
  const monthTotal = [...byDay.values()].reduce((sum, v) => sum + v.total, 0)

  const daysInMonth = getDaysInMonth(year, month)
  const firstDay = getFirstDayOfMonth(year, month)
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const weeks = []
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7))
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={prevMonth}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={ArrowLeft02Icon} size={16} />
        </button>

        <div className="flex items-center gap-4">
          <span className="font-semibold text-base">{MONTH_NAMES[month - 1]} {year}</span>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className={cn('font-medium', monthTotal >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400')}>
              {monthTotal >= 0 ? '+' : '-'}${fmt(monthTotal)}
            </span>
            {tradingDays > 0 && (
              <span>{winDays}/{tradingDays} days</span>
            )}
          </div>
        </div>

        <button
          onClick={nextMonth}
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-muted transition-colors"
        >
          <HugeiconsIcon icon={ArrowRight02Icon} size={16} />
        </button>
      </div>

      {/* Calendar grid */}
      <div className="rounded-lg border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DAY_LABELS.map((d) => (
            <div key={d} className="py-2 text-center text-xs font-medium text-muted-foreground tracking-wide uppercase">
              {d}
            </div>
          ))}
        </div>

        {/* Weeks */}
        <div className="divide-y">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 divide-x">
              {week.map((day, di) => {
                if (!day) {
                  return <div key={di} className="h-28 bg-muted/10" />
                }

                const data = byDay.get(day)
                const isToday = day === todayDay && month === todayMonth && year === todayYear

                return (
                  <div
                    key={di}
                    className={cn(
                      'h-28 p-2 flex flex-col gap-1 relative',
                      data
                        ? data.total >= 0
                          ? 'bg-green-50 dark:bg-green-950/20'
                          : 'bg-red-50 dark:bg-red-950/20'
                        : 'bg-background'
                    )}
                  >
                    {data && (
                      <div className={cn('absolute left-0 inset-y-0 w-[3px]', data.total >= 0 ? 'bg-green-500' : 'bg-red-500')} />
                    )}

                    {/* Day number */}
                    <div className="flex justify-end">
                      <span
                        className={cn(
                          'flex items-center justify-center w-6 h-6 rounded-full text-xs font-medium',
                          isToday
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground'
                        )}
                      >
                        {day}
                      </span>
                    </div>

                    {/* P&L — old style: stacked top-left */}
                    {data && (
                      <div className="pl-1 flex flex-col">
                        <span className={cn('font-medium text-sm', data.total >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400')}>
                          {data.total >= 0 ? '+' : ''}${Math.abs(data.total).toFixed(0)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {data.count} trade{data.count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    )}
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
