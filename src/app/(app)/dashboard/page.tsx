import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { calcOpenRisk } from '@/lib/trades'
import { expectedCumPnL, monthlyBreakdown } from '@/lib/goals'
import { EquityChart, type EquityDataPoint } from '@/components/equity-chart'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import Link from 'next/link'

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

  // Open trades for risk calculation
  const openTrades = await prisma.trade.findMany({
    where: { userId: user.id, accountId: mainAccount.id, closeDate: null },
    select: { entryPrice: true, quantity: true, contractSize: true, ticker: true, side: true, expiration: true, projectedProfit: true, openDate: true },
    orderBy: { openDate: 'asc' },
    take: 5,
  })

  // All open trades for risk (not just top 5)
  const allOpenTrades = await prisma.trade.findMany({
    where: { userId: user.id, accountId: mainAccount.id, closeDate: null },
    select: { entryPrice: true, quantity: true, contractSize: true },
  })

  // Goal for current year
  const goal = await prisma.goal.findFirst({
    where: { userId: user.id, accountId: mainAccount.id, year: currentYear },
  })

  // KPI calculations
  const monthlyPnl = currentMonthTrades.reduce((s, t) => s + Number(t.netPnl ?? 0), 0)
  const ytdPnl = ytdTrades.reduce((s, t) => s + Number(t.netPnl ?? 0), 0)
  const winningTrades = ytdTrades.filter((t) => Number(t.netPnl ?? 0) > 0).length
  const winRate = ytdTrades.length > 0 ? (winningTrades / ytdTrades.length) * 100 : 0
  const openRisk = calcOpenRisk(allOpenTrades.map((t) => ({
    entryPrice: Number(t.entryPrice),
    quantity: Number(t.quantity),
    contractSize: t.contractSize,
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

  // Goal progress
  const goalExpectedYTD = g ? expectedCumPnL(g, today) : 0
  const goalAmount = g?.goalAmount ?? 0
  const goalActualPct = goalAmount > 0 ? Math.min(1, ytdPnl / goalAmount) * 100 : 0
  const goalExpectedPct = goalAmount > 0 ? Math.min(1, goalExpectedYTD / goalAmount) * 100 : 0

  const kpis = [
    {
      title: 'Monthly P&L',
      value: `${monthlyPnl >= 0 ? '+' : ''}$${fmt(monthlyPnl)}`,
      color: monthlyPnl >= 0 ? 'text-green-600' : 'text-red-600',
    },
    {
      title: 'Win Rate (YTD)',
      value: `${winRate.toFixed(1)}%`,
      sub: `${winningTrades} / ${ytdTrades.length} trades`,
    },
    {
      title: 'Open Risk',
      value: `$${fmt(openRisk)}`,
      color: 'text-orange-600',
    },
    {
      title: '% Return (YTD)',
      value: `${pctReturn >= 0 ? '+' : ''}${pctReturn.toFixed(2)}%`,
      color: pctReturn >= 0 ? 'text-green-600' : 'text-red-600',
    },
  ]

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {kpis.map(({ title, value, sub, color }) => (
          <Card key={title}>
            <CardHeader className="pb-1">
              <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className={cn('text-2xl font-bold', color)}>{value}</p>
              {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Chart row */}
      <div className="grid grid-cols-3 gap-4">
        {/* Equity chart */}
        <div className="col-span-2 rounded-lg border p-4">
          <h2 className="text-sm font-medium mb-3">Equity {currentYear}</h2>
          <EquityChart data={equityData} />
        </div>

        {/* Goal progress + open positions */}
        <div className="space-y-4">
          {/* Goal progress */}
          {goal ? (
            <div className="rounded-lg border p-4 space-y-3">
              <h2 className="text-sm font-medium">Goal Progress</h2>
              <div className="space-y-2 text-xs text-muted-foreground">
                <div className="flex items-center gap-2">
                  <span className="w-16">Actual</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full" style={{ width: `${goalActualPct}%` }} />
                  </div>
                  <span className="w-10 text-right">{goalActualPct.toFixed(0)}%</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-16">Expected</span>
                  <div className="flex-1 bg-muted rounded-full h-2">
                    <div className="bg-blue-400 h-2 rounded-full" style={{ width: `${goalExpectedPct}%` }} />
                  </div>
                  <span className="w-10 text-right">{goalExpectedPct.toFixed(0)}%</span>
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex justify-between">
                <span>Actual: ${fmt(ytdPnl)}</span>
                <span>Goal: ${goalAmount.toLocaleString()}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border p-4 text-center text-sm text-muted-foreground">
              <p>No goal for {currentYear}.</p>
              <Link href="/goals" className="text-primary hover:underline text-xs">Create one →</Link>
            </div>
          )}

          {/* Open positions mini-table */}
          <div className="rounded-lg border p-4 space-y-2">
            <h2 className="text-sm font-medium">Open Positions</h2>
            {openTrades.length === 0 ? (
              <p className="text-xs text-muted-foreground">No open trades</p>
            ) : (
              <div className="space-y-1">
                {openTrades.map((t, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="font-mono font-medium">{t.ticker}</span>
                    <Badge variant={t.side === 'LONG' ? 'default' : 'secondary'} className="text-xs px-1 py-0">{t.side}</Badge>
                    <span className="text-muted-foreground">${Number(t.entryPrice).toFixed(2)}</span>
                    <span className={t.projectedProfit ? (Number(t.projectedProfit) >= 0 ? 'text-green-600' : 'text-red-600') : 'text-muted-foreground'}>
                      {t.projectedProfit ? `$${Number(t.projectedProfit).toFixed(0)}` : '—'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
