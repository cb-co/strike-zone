import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { AccountsTable } from '@/components/accounts-table'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      cashActivities: { orderBy: { date: 'desc' } },
    },
  })

  const accountsWithBalance = await Promise.all(
    accounts.map(async (account) => {
      const result = await prisma.trade.aggregate({
        where: { accountId: account.id, userId: user.id, closeDate: { not: null } },
        _sum: { netPnl: true },
      })
      const netPnl = Number(result._sum.netPnl ?? 0)
      const cashSum = account.cashActivities.reduce((sum, a) => sum + Number(a.amount), 0)
      return {
        id: account.id,
        userId: account.userId,
        name: account.name,
        broker: account.broker,
        description: account.description,
        isActive: account.isActive,
        isMain: account.isMain,
        startingBalance: Number(account.startingBalance),
        commissionPerOption: Number(account.commissionPerOption),
        commissionPerStock: Number(account.commissionPerStock),
        optionAssignmentFee: Number(account.optionAssignmentFee),
        createdAt: account.createdAt,
        currentBalance: Number(account.startingBalance) + netPnl + cashSum,
        cashActivities: account.cashActivities.map(a => ({
          id: a.id,
          date: a.date.toISOString().slice(0, 10),
          description: a.description,
          type: a.type as string,
          amount: Number(a.amount),
          currency: a.currency,
          importBatchId: a.importBatchId,
        })),
      }
    })
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
      </div>
      <AccountsTable accounts={accountsWithBalance} />
    </div>
  )
}
