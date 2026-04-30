import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { InstrumentsTable } from '@/components/instruments-table'

export default async function InstrumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const instruments = await prisma.instrument.findMany({
    where: { userId: user.id },
    orderBy: { ticker: 'asc' },
  })

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Instruments</h1>
      <InstrumentsTable instruments={instruments} />
    </div>
  )
}
