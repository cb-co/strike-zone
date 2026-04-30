import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { monthlyBreakdown, expectedCumPnL } from '@/lib/goals'
import { cn } from '@/lib/utils'

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
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-4">Monthly Performance</h1>
        <p className="text-muted-foreground">No goal found. Create a goal on the Goals page first.</p>
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

  // Fetch actual trades for this goal's account and year
  const trades = await prisma.trade.findMany({
    where: {
      userId: user.id,
      accountId: goal.accountId,
      closeDate: { not: null },
    },
    select: { closeDate: true, netPnl: true },
  })

  const actualMonthlyPnl = Array(12).fill(0)
  for (const trade of trades) {
    if (!trade.closeDate || !trade.netPnl) continue
    const d = new Date(trade.closeDate)
    if (d.getFullYear() !== goal.year) continue
    actualMonthlyPnl[d.getMonth()] += Number(trade.netPnl)
  }

  const today = new Date()
  const currentMonth = today.getMonth() // 0-indexed
  const currentYear = today.getFullYear()
  const isCurrentYear = goal.year === currentYear

  const actualYTD = actualMonthlyPnl.reduce((s, v) => s + v, 0)
  const expectedYTD = isCurrentYear ? expectedCumPnL(g, today) : g.goalAmount

  // Running cumulative totals
  let cumActual = 0
  let cumExpected = 0

  const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

  // Suppress unused variable warning — allGoals is available for future goal selector UI
  void allGoals

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Monthly Performance</h1>
        {/* Goal selector */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Viewing:</span>
          <span className="font-medium">{goal.year} — {goal.account.name}</span>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Goal Amount', value: `$${g.goalAmount.toLocaleString()}` },
          { label: 'Actual YTD', value: `$${actualYTD.toFixed(2)}`, color: actualYTD >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'Expected YTD', value: `$${expectedYTD.toFixed(2)}` },
          { label: 'Gap', value: `${(actualYTD - expectedYTD) >= 0 ? '+' : ''}$${(actualYTD - expectedYTD).toFixed(2)}`, color: (actualYTD - expectedYTD) >= 0 ? 'text-green-600' : 'text-red-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-lg border p-4 space-y-1">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={cn('text-xl font-semibold', color)}>{value}</p>
          </div>
        ))}
      </div>

      {/* 12-month breakdown table */}
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Month</th>
              <th className="px-4 py-3 text-right font-medium">Exp. P&L</th>
              <th className="px-4 py-3 text-right font-medium">Exp. Var WD</th>
              <th className="px-4 py-3 text-right font-medium">Exp. Total</th>
              <th className="px-4 py-3 text-right font-medium">Actual P&L</th>
              <th className="px-4 py-3 text-right font-medium">vs Expected</th>
              <th className="px-4 py-3 text-right font-medium">Cum. Actual</th>
              <th className="px-4 py-3 text-right font-medium">Cum. Expected</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {breakdown.map((b, i) => {
              const month = i + 1
              const actual = actualMonthlyPnl[i]
              const isFuture = isCurrentYear && i > currentMonth
              const isCurrent = isCurrentYear && i === currentMonth

              cumActual += actual
              cumExpected += b.expectedPnl

              return (
                <tr
                  key={month}
                  className={cn(
                    isCurrent && 'bg-purple-50 dark:bg-purple-950/20',
                    isFuture && 'opacity-50'
                  )}
                >
                  <td className="px-4 py-2.5 font-medium">{MONTH_NAMES[i]}</td>
                  <td className="px-4 py-2.5 text-right">${b.expectedPnl.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">${b.expectedVarWd.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">${b.expectedTotal.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">
                    {isFuture ? <span className="text-muted-foreground">—</span> : (
                      <span className={actual >= 0 ? 'text-green-600' : 'text-red-600'}>${actual.toFixed(2)}</span>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {isFuture
                      ? <span className="text-xs bg-muted rounded px-1 py-0.5">future</span>
                      : <span className={(actual - b.expectedPnl) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          {(actual - b.expectedPnl) >= 0 ? '+' : ''}${(actual - b.expectedPnl).toFixed(2)}
                        </span>
                    }
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">
                    {isFuture ? '—' : `$${cumActual.toFixed(2)}`}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono">${cumExpected.toFixed(2)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
