import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { monthlyBreakdown, expectedCumPnL } from '@/lib/goals'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { PageHeader } from '@/components/page-header'
import { Flap } from '@/components/flap'
import Link from 'next/link'

export default async function MonthlyPage(props: { searchParams?: Promise<Record<string, string | string[]>> }) {
  const searchParams = await props.searchParams
  const goalId = searchParams?.goalId as string | undefined

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Get goal — either by goalId or find current year's goal for main account
  let goal = null
  if (goalId) {
    goal = await prisma.goal.findUnique({
      where: { id: goalId, userId: user.id },
      include: { account: { select: { name: true } } },
    })
  }
  if (!goal) {
    const mainAccount = await prisma.account.findFirst({ where: { userId: user.id, isMain: true } })
    if (mainAccount) {
      goal = await prisma.goal.findFirst({
        where: { userId: user.id, accountId: mainAccount.id, year: new Date().getFullYear() },
        include: { account: { select: { name: true } } },
      })
    }
  }

  // All goals for the selector
  const allGoals = await prisma.goal.findMany({
    where: { userId: user.id },
    include: { account: { select: { name: true } } },
    orderBy: [{ year: 'desc' }],
  })

  if (!goal) {
    return (
      <div className="px-4 py-5 md:px-8 md:py-7 space-y-7">
        <PageHeader page="monthly" title="Monthly" />
        <div className="rounded-lg border border-dashed p-8 max-w-xl space-y-1.5">
          <p className="text-[15px] font-semibold">No timetable to show</p>
          <p className="text-[13px] text-muted-foreground">
            The monthly view breaks a yearly goal into what each month should earn and withdraw.{' '}
            <Link href="/goals" className="text-primary font-semibold hover:underline">Create a goal</Link> for your main account first.
          </p>
        </div>
      </div>
    )
  }

  const g = {
    goalAmount: Number(goal.goalAmount),
    curveFactor: Number(goal.curveFactor),
    monthlyFixedWd: Number(goal.monthlyFixedWd),
    monthlyVariableWdPct: Number(goal.monthlyVariableWdPct),
  }

  const breakdown = monthlyBreakdown(g)

  // Fetch actual trades and cash activities for this goal's account and year
  const [trades, cashActivities] = await Promise.all([
    prisma.trade.findMany({
      where: {
        userId: user.id,
        accountId: goal.accountId,
        closeDate: { not: null },
      },
      select: { closeDate: true, netPnl: true },
    }),
    prisma.cashActivity.findMany({
      where: {
        userId: user.id,
        accountId: goal.accountId,
        type: { not: 'DEPOSIT' },
        date: {
          gte: new Date(`${goal.year}-01-01`),
          lt: new Date(`${goal.year + 1}-01-01`),
        },
      },
      select: { date: true, amount: true },
    }),
  ])

  const actualMonthlyPnl = Array(12).fill(0)
  for (const trade of trades) {
    if (!trade.closeDate || !trade.netPnl) continue
    const d = new Date(trade.closeDate)
    if (d.getUTCFullYear() !== goal.year) continue
    actualMonthlyPnl[d.getUTCMonth()] += Number(trade.netPnl)
  }
  for (const ca of cashActivities) {
    actualMonthlyPnl[new Date(ca.date).getUTCMonth()] += Number(ca.amount)
  }

  const today = new Date()
  const currentMonth = today.getMonth() // 0-indexed
  const currentYear = today.getFullYear()
  const isCurrentYear = goal.year === currentYear

  const actualYTD = actualMonthlyPnl.reduce((s, v) => s + v, 0)
  const expectedYTD = isCurrentYear ? expectedCumPnL(g, today) : g.goalAmount

  // Running cumulative totals, precomputed per month
  const cumActualByMonth: number[] = []
  const cumExpectedByMonth: number[] = []
  breakdown.reduce(
    (acc, b, i) => {
      const next = { a: acc.a + actualMonthlyPnl[i], e: acc.e + b.expectedPnl }
      cumActualByMonth.push(next.a)
      cumExpectedByMonth.push(next.e)
      return next
    },
    { a: 0, e: 0 },
  )

  // Totals row — sum non-cumulative columns; skip future months for actuals
  const totalExpectedPnl = breakdown.reduce((s, b) => s + b.expectedPnl, 0)
  const totalFixedWd = g.monthlyFixedWd * 12
  const totalVarWd = breakdown.reduce((s, b) => s + b.expectedVarWd, 0)
  const totalExpectedTotal = breakdown.reduce((s, b) => s + b.expectedTotal, 0)
  const totalActual = actualYTD
  const totalVsExpected = breakdown.reduce((s, b, i) => {
    if (isCurrentYear && i > currentMonth) return s
    return s + (actualMonthlyPnl[i] - b.expectedTotal)
  }, 0)

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  // Suppress unused variable warning — allGoals is available for future goal selector UI
  void allGoals

  const gapYTD = actualYTD - expectedYTD
  const signedMoney = (n: number) => `${n > 0 ? '+' : ''}${formatCurrency(n)}`
  const figures = [
    { label: 'Goal', value: formatCurrency(g.goalAmount), tone: 'ink' as const },
    { label: 'Actual YTD', value: `${actualYTD > 0 ? '+' : ''}${formatCurrency(actualYTD)}`, tone: actualYTD >= 0 ? 'gain' as const : 'loss' as const },
    { label: 'Scheduled YTD', value: formatCurrency(expectedYTD), tone: 'dim' as const },
    { label: gapYTD >= 0 ? 'Ahead by' : 'Behind by', value: formatCurrency(Math.abs(gapYTD)), tone: gapYTD >= 0 ? 'gain' as const : 'loss' as const },
  ]
  const TH = 'px-4 py-2.5 text-right whitespace-nowrap'
  const TD = 'px-4 py-2.5 text-right whitespace-nowrap'

  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-7">
      <PageHeader page="monthly" title="Monthly" meta={<>{goal.year} timetable · {goal.account.name}</>} />

      <dl className="board grid grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4 px-4 md:px-5 py-4">
        {figures.map((f, i) => (
          <div key={f.label} className="min-w-0">
            <dt className="board-label mb-1.5">{f.label}</dt>
            <dd><Flap id={`monthly:${goal.id}:${f.label}`} value={f.value} tone={f.tone} size="md" delay={i * 40} /></dd>
          </div>
        ))}
      </dl>

      <div className="rounded-lg ring-1 ring-border bg-card relative overflow-x-auto">
        <table className="data-table w-full text-[13px]">
          <thead className="border-b bg-muted/60">
            <tr>
              <th className="px-4 py-2.5 text-left">Month</th>
              <th className={TH}>Sched. P&amp;L</th>
              <th className={TH}>Fixed WD</th>
              <th className={TH}>Var. WD</th>
              <th className={TH}>Sched. total</th>
              <th className={TH}>Actual P&amp;L</th>
              <th className={TH}>vs Sched.</th>
              <th className={TH}>Cum. actual</th>
              <th className={TH}>Cum. sched.</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {breakdown.map((b, i) => {
              const month = i + 1
              const actual = actualMonthlyPnl[i]
              const isFuture = isCurrentYear && i > currentMonth
              const isCurrent = isCurrentYear && i === currentMonth
              const vs = actual - b.expectedTotal

              const cumActual = cumActualByMonth[i]
              const cumExpected = cumExpectedByMonth[i]

              return (
                <tr
                  key={month}
                  aria-current={isCurrent ? 'date' : undefined}
                  className={cn(
                    isCurrent && 'bg-accent',
                    isFuture && 'text-muted-foreground'
                  )}
                >
                  <td className="px-4 py-2.5 font-semibold whitespace-nowrap">
                    {MONTH_NAMES[i]}
                    {isCurrent && (
                      <span className="ml-2 align-middle rounded-sm bg-primary px-1.5 py-px sign-caps text-[10px] text-primary-foreground">Now</span>
                    )}
                  </td>
                  <td className={TD}>{formatCurrency(b.expectedPnl)}</td>
                  <td className={TD}>{formatCurrency(g.monthlyFixedWd)}</td>
                  <td className={TD}>{formatCurrency(b.expectedVarWd)}</td>
                  <td className={cn(TD, 'font-medium')}>{formatCurrency(b.expectedTotal)}</td>
                  <td className={TD}>
                    {isFuture ? '—' : (
                      <span className={cn('font-semibold', actual >= 0 ? 'text-gain' : 'text-loss')}>{formatCurrency(actual)}</span>
                    )}
                  </td>
                  <td className={TD}>
                    {isFuture ? '—' : (
                      <span className={vs >= 0 ? 'text-gain' : 'text-loss'}>{signedMoney(vs)}</span>
                    )}
                  </td>
                  <td className={TD}>{isFuture ? '—' : formatCurrency(cumActual)}</td>
                  <td className={cn(TD, 'text-muted-foreground')}>{formatCurrency(cumExpected)}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="border-t-2 border-foreground/15 bg-muted/60">
            <tr className="font-semibold">
              <td className="px-4 py-3 sign-caps text-[11px] text-muted-foreground">Year</td>
              <td className={TD}>{formatCurrency(totalExpectedPnl)}</td>
              <td className={TD}>{formatCurrency(totalFixedWd)}</td>
              <td className={TD}>{formatCurrency(totalVarWd)}</td>
              <td className={TD}>{formatCurrency(totalExpectedTotal)}</td>
              <td className={cn(TD, totalActual >= 0 ? 'text-gain' : 'text-loss')}>{formatCurrency(totalActual)}</td>
              <td className={cn(TD, totalVsExpected >= 0 ? 'text-gain' : 'text-loss')}>{signedMoney(totalVsExpected)}</td>
              <td className={cn(TD, 'text-muted-foreground')}>—</td>
              <td className={cn(TD, 'text-muted-foreground')}>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
