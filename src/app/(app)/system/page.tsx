import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SetupsSection } from '@/components/setups-section'
import { TSSection } from '@/components/ts-section'

export default async function SystemPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [setups, tsToken] = await Promise.all([
    prisma.setup.findMany({ where: { userId: user.id }, orderBy: { name: 'asc' } }),
    prisma.tradestationToken.findUnique({ where: { userId: user.id } }),
  ])

  const isConnected = !!tsToken
  const lastSynced = tsToken?.updatedAt ?? null

  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">System</h1>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">TradeStation Integration</h2>
        <TSSection isConnected={isConnected} lastSynced={lastSynced} />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Trade Setups</h2>
        <SetupsSection setups={setups} />
      </section>
    </div>
  )
}
