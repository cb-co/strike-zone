'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { PnlCalendar } from '@/components/pnl-calendar'

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

export function CalendarTab({ trades, month, year }: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  function navigate(newMonth: number, newYear: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', 'calendar')
    params.set('month', String(newMonth))
    params.set('year', String(newYear))
    router.push(`?${params.toString()}`)
  }

  return (
    <PnlCalendar
      trades={trades}
      month={month}
      year={year}
      onPrev={() => (month === 1 ? navigate(12, year - 1) : navigate(month - 1, year))}
      onNext={() => (month === 12 ? navigate(1, year + 1) : navigate(month + 1, year))}
      onDay={(d) => router.push(`/trades?tab=closed&dateFrom=${d}&dateTo=${d}`)}
    />
  )
}
