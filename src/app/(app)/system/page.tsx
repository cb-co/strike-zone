import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { SetupsSection } from '@/components/setups-section'
import { TSSection } from '@/components/ts-section'
import { PageHeader, SectionTitle } from '@/components/page-header'

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
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-9 max-w-4xl">
      <PageHeader page="system" title="System" meta="Connections and trade tags" />

      <section className="space-y-3">
        <SectionTitle>TradeStation</SectionTitle>
        <TSSection isConnected={isConnected} lastSynced={lastSynced} />
      </section>

      <section className="space-y-3">
        <SectionTitle>Trade setups</SectionTitle>
        <SetupsSection setups={setups} />
      </section>
    </div>
  )
}
