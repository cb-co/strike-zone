import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { GoalCard, type GoalCardData } from '@/components/goal-card'
import { NewGoalButton } from '@/components/new-goal-button'
import { PageHeader } from '@/components/page-header'

export default async function GoalsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [goals, accounts] = await Promise.all([
    prisma.goal.findMany({
      where: { userId: user.id },
      include: { account: { select: { name: true } } },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
    }),
    prisma.account.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    }),
  ])

  // For each goal, compute actual monthly P&L from trades + cash activities
  const goalsWithPnl: GoalCardData[] = await Promise.all(
    goals.map(async (goal) => {
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

      return {
        id: goal.id,
        year: goal.year,
        accountId: goal.accountId,
        accountName: goal.account.name,
        goalAmount: Number(goal.goalAmount),
        curveFactor: Number(goal.curveFactor),
        monthlyFixedWd: Number(goal.monthlyFixedWd),
        monthlyVariableWdPct: Number(goal.monthlyVariableWdPct),
        actualMonthlyPnl,
      }
    })
  )

  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-7 max-w-6xl">
      <PageHeader page="goals" title="Goals" meta="Yearly income timetables" actions={<NewGoalButton accounts={accounts} />} />
      <div className="space-y-4">
        {goalsWithPnl.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
        {goalsWithPnl.length === 0 && (
          <div className="rounded-lg border border-dashed p-8 max-w-xl space-y-1.5">
            <p className="text-[15px] font-semibold">No goals yet</p>
            <p className="text-[13px] text-muted-foreground">
              A goal sets the year&apos;s income target, how it builds month by month (the curve), and what you plan to withdraw. The dashboard then tells you whether the book is ahead of or behind it.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
