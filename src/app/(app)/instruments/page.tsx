import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { InstrumentsTable } from '@/components/instruments-table'
import { PageHeader } from '@/components/page-header'

export default async function InstrumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const instruments = await prisma.instrument.findMany({
    where: { userId: user.id },
    orderBy: { ticker: 'asc' },
  })

  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-6">
      <PageHeader page="instruments" title="Instruments" />
      <InstrumentsTable instruments={instruments} />
    </div>
  )
}
