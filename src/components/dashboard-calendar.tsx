'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PnlCalendar } from '@/components/pnl-calendar'

type Trade = {
  id: string
  closeDate: Date | string | null
  netPnl: number | null
}

type Props = {
  trades: Trade[]
  initialMonth: number // 1-12
  initialYear: number
}

export function DashboardCalendar({ trades, initialMonth, initialYear }: Props) {
  const [month, setMonth] = useState(initialMonth)
  const [year, setYear] = useState(initialYear)
  const router = useRouter()

  function prevMonth() {
    if (month === 1) { setMonth(12); setYear(y => y - 1) }
    else setMonth(m => m - 1)
  }

  function nextMonth() {
    if (month === 12) { setMonth(1); setYear(y => y + 1) }
    else setMonth(m => m + 1)
  }

  return (
    <PnlCalendar
      trades={trades}
      month={month}
      year={year}
      onPrev={prevMonth}
      onNext={nextMonth}
      onDay={(d) => router.push(`/trades?tab=closed&dateFrom=${d}&dateTo=${d}`)}
      cellHeight="sm"
    />
  )
}
