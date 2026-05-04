import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { GoalCard, type GoalCardData } from '@/components/goal-card'
import { NewGoalButton } from '@/components/new-goal-button'

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

  // For each goal, compute actual monthly P&L from trades
  const goalsWithPnl: GoalCardData[] = await Promise.all(
    goals.map(async (goal) => {
      const trades = await prisma.trade.findMany({
        where: {
          userId: user.id,
          accountId: goal.accountId,
          closeDate: { not: null },
          // Filter to the goal's year
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
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Goals</h1>
        <NewGoalButton accounts={accounts} />
      </div>
      <div className="space-y-4">
        {goalsWithPnl.map((goal) => (
          <GoalCard key={goal.id} goal={goal} />
        ))}
        {goalsWithPnl.length === 0 && (
          <p className="text-muted-foreground text-sm">No goals yet. Create one to track your annual P&L target.</p>
        )}
      </div>
    </div>
  )
}
