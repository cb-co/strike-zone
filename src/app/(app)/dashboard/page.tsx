import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcOpenRisk } from '@/lib/trades'
import { expectedCumPnL, monthlyBreakdown } from '@/lib/goals'
import { EquityChart, type EquityDataPoint } from '@/components/equity-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import Link from 'next/link'
import { DashboardOpenPositions, type DashboardPosition } from '@/components/dashboard-open-positions'
import { AddTradeButton } from '@/components/add-trade-button'

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function fmt(n: number, opts?: Intl.NumberFormatOptions) {
  return n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2, ...opts })
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const mainAccount = await prisma.account.findFirst({
    where: { userId: user.id, isMain: true },
  })

  if (!mainAccount) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <div className="rounded-lg border p-6 text-center text-muted-foreground">
          No main account set.{' '}
          <Link href="/accounts" className="text-primary hover:underline">Set one in Accounts →</Link>
        </div>
      </div>
    )
  }

  const today = new Date()
  const currentYear = today.getFullYear()
  const currentMonth = today.getMonth() // 0-indexed

  // Fetch closed trades for current year on main account
  const closedTrades = await prisma.trade.findMany({
    where: {
      userId: user.id,
      accountId: mainAccount.id,
      closeDate: { not: null },
    },
    select: { netPnl: true, closeDate: true },
  })

  const ytdTrades = closedTrades.filter((t) => {
    if (!t.closeDate) return false
    return new Date(t.closeDate).getFullYear() === currentYear
  })

  const currentMonthTrades = ytdTrades.filter((t) => {
    if (!t.closeDate) return false
    return new Date(t.closeDate).getMonth() === currentMonth
  })

  // Open trades — full data for table + actions + risk
  const [rawOpenTrades, accounts, setups, goal] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: user.id, accountId: mainAccount.id, closeDate: null },
      select: {
        id: true, name: true, ticker: true, symbol: true,
        side: true, entryPrice: true, quantity: true, contractSize: true,
        optionType: true, strike: true, expiration: true,
        projectedProfit: true, openDate: true, accountId: true, notes: true,
        tradeSetups: { select: { setupId: true } },
      },
      orderBy: { openDate: 'asc' },
    }),
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    prisma.setup.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    prisma.goal.findFirst({ where: { userId: user.id, accountId: mainAccount.id, year: currentYear } }),
  ])

  const openPositions: DashboardPosition[] = rawOpenTrades.map((t) => ({
    id: t.id,
    name: t.name,
    ticker: t.ticker,
    symbol: t.symbol,
    side: t.side as 'LONG' | 'SHORT',
    entryPrice: Number(t.entryPrice),
    quantity: Number(t.quantity),
    contractSize: t.contractSize,
    optionType: t.optionType as 'CALL' | 'PUT' | null,
    strike: t.strike ? Number(t.strike) : null,
    expiration: t.expiration?.toISOString() ?? null,
    projectedProfit: t.projectedProfit ? Number(t.projectedProfit) : null,
    openDate: t.openDate.toISOString(),
    accountId: t.accountId,
    notes: t.notes ?? null,
    tradeSetups: t.tradeSetups,
  }))

  // KPI calculations
  const monthlyPnl = currentMonthTrades.reduce((s, t) => s + Number(t.netPnl ?? 0), 0)
  const ytdPnl = ytdTrades.reduce((s, t) => s + Number(t.netPnl ?? 0), 0)
  const winningTrades = ytdTrades.filter((t) => Number(t.netPnl ?? 0) > 0).length
  const winRate = ytdTrades.length > 0 ? (winningTrades / ytdTrades.length) * 100 : 0
  const openRisk = calcOpenRisk(openPositions.map((t) => ({
    side: t.side,
    optionType: t.optionType,
    entryPrice: t.entryPrice,
    quantity: t.quantity,
    contractSize: t.contractSize,
    strike: t.strike,
  })))
  const startingBalance = Number(mainAccount.startingBalance)
  const pctReturn = startingBalance > 0 ? (ytdPnl / startingBalance) * 100 : 0

  // Equity chart data — monthly
  const actualMonthlyPnl = Array(12).fill(0)
  for (const trade of ytdTrades) {
    if (!trade.closeDate) continue
    actualMonthlyPnl[new Date(trade.closeDate).getMonth()] += Number(trade.netPnl ?? 0)
  }

  let cumActual = startingBalance
  let cumExpected = startingBalance

  const g = goal
    ? {
        goalAmount: Number(goal.goalAmount),
        curveFactor: Number(goal.curveFactor),
        monthlyFixedWd: Number(goal.monthlyFixedWd),
        monthlyVariableWdPct: Number(goal.monthlyVariableWdPct),
      }
    : null

  const breakdown = g ? monthlyBreakdown(g) : null

  const equityData: EquityDataPoint[] = MONTH_LABELS.map((label, i) => {
    cumActual += actualMonthlyPnl[i]
    if (breakdown) cumExpected += breakdown[i].expectedPnl
    return {
      month: label,
      actual: cumActual,
      expected: breakdown ? cumExpected : null,
    }
  })

  // Goal progress — yearly
  const goalExpectedYTD = g ? expectedCumPnL(g, today) : 0
  const goalAmount = g?.goalAmount ?? 0
  const goalActualPct = goalAmount > 0 ? Math.max(0, Math.min(1, ytdPnl / goalAmount)) * 100 : 0
  const goalExpectedPct = goalAmount > 0 ? Math.max(0, Math.min(1, goalExpectedYTD / goalAmount)) * 100 : 0

  // Goal progress — current month
  const monthExpected = breakdown ? breakdown[currentMonth].expectedPnl : 0
  const monthGap = monthlyPnl - monthExpected
  const monthActualPct = monthExpected > 0 ? Math.max(0, Math.min(1, monthlyPnl / monthExpected)) * 100 : 0

  const kpis = [
    {
      title: 'Monthly P&L',
      value: `${monthlyPnl >= 0 ? '+' : ''}$${fmt(monthlyPnl)}`,
      valueClass: monthlyPnl >= 0 ? 'text-emerald-600' : 'text-rose-600',
      accent: monthlyPnl >= 0 ? '#10b981' : '#f43f5e',
    },
    {
      title: 'Win Rate (YTD)',
      value: `${winRate.toFixed(1)}%`,
      sub: `${winningTrades} / ${ytdTrades.length} trades`,
      valueClass: '',
      accent: '#94a3b8',
    },
    {
      title: 'Open Risk',
      value: `$${fmt(openRisk)}`,
      valueClass: 'text-amber-600',
      accent: '#f59e0b',
    },
    {
      title: '% Return (YTD)',
      value: `${pctReturn >= 0 ? '+' : ''}${pctReturn.toFixed(2)}%`,
      valueClass: pctReturn >= 0 ? 'text-emerald-600' : 'text-rose-600',
      accent: pctReturn >= 0 ? '#10b981' : '#f43f5e',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <AddTradeButton accounts={accounts} setups={setups} />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {kpis.map(({ title, value, sub, valueClass, accent }) => (
          <Card key={title} className="border-l-[3px]" style={{ borderLeftColor: accent }}>
            <CardHeader className="pb-1 pt-4 px-4">
              <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <p className={cn('text-2xl font-semibold tabular-nums', valueClass)}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Equity chart */}
        <div className="lg:col-span-2 rounded-lg border p-4">
          <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-4">Equity {currentYear}</h2>
          <EquityChart data={equityData} />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Current month goal */}
          {goal && breakdown ? (
            <div className="rounded-lg border p-4 space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{MONTH_LABELS[currentMonth]} Goal</h2>
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <p className="text-muted-foreground mb-0.5">Actual</p>
                  <p className={cn('font-semibold text-sm tabular-nums', monthlyPnl >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {monthlyPnl >= 0 ? '+' : ''}${fmt(monthlyPnl)}
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Expected</p>
                  <p className="font-semibold text-sm tabular-nums">${fmt(monthExpected)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground mb-0.5">Gap</p>
                  <p className={cn('font-semibold text-sm tabular-nums', monthGap >= 0 ? 'text-emerald-600' : 'text-rose-600')}>
                    {monthGap >= 0 ? '+' : ''}${fmt(monthGap)}
                  </p>
                </div>
              </div>
              {monthExpected > 0 && (
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                      <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${Math.min(100, monthActualPct)}%` }} />
                    </div>
                    <span className="w-8 text-right tabular-nums">{monthActualPct.toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {/* Yearly goal progress */}
          {goal ? (
            <div className="rounded-lg border p-4 space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Year Goal</h2>
              <div className="space-y-2.5 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0">Actual</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full transition-all" style={{ width: `${goalActualPct}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{goalActualPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0">Expected</span>
                  <div className="flex-1 bg-muted rounded-full h-1.5 overflow-hidden">
                    <div className="bg-blue-400 h-full rounded-full transition-all" style={{ width: `${goalExpectedPct}%` }} />
                  </div>
                  <span className="w-10 text-right tabular-nums">{goalExpectedPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex justify-between pt-0.5">
                <span className="tabular-nums">${fmt(ytdPnl)} of ${goalAmount.toLocaleString()}</span>
                <Link href="/monthly" className="text-primary hover:underline">Details →</Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
              <p>No goal for {currentYear}.</p>
              <Link href="/goals" className="text-primary hover:underline text-xs">Create one →</Link>
            </div>
          )}

        </div>
      </div>

      {/* Open positions — full width */}
      <div className="rounded-lg border p-4 space-y-3">
        <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Open Positions</h2>
        <DashboardOpenPositions
          positions={openPositions}
          accounts={accounts}
          setups={setups}
        />
      </div>
    </div>
  )
}
