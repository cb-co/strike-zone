import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { getValidToken, fetchOrders, mapOrderToTrade } from '@/lib/tradestation'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const accessToken = await getValidToken(user.id)

    // Get user's main account to find the TS account key
    const mainAccount = await prisma.account.findFirst({
      where: { userId: user.id, isMain: true },
    })
    if (!mainAccount) {
      return NextResponse.json({ error: 'No main account set' }, { status: 400 })
    }

    const orders = await fetchOrders(accessToken, mainAccount.broker)

    let created = 0
    let updated = 0

    for (const order of orders) {
      const tradeData = mapOrderToTrade(order, user.id, mainAccount.id)

      const existing = await prisma.trade.findFirst({
        where: {
          userId: user.id,
          symbol: tradeData.symbol,
          openDate: tradeData.openDate,
          source: 'TS_IMPORT',
        },
      })

      if (existing) {
        await prisma.trade.update({
          where: { id: existing.id },
          data: tradeData,
        })
        updated++
      } else {
        await prisma.trade.create({ data: tradeData })
        created++
      }
    }

    return NextResponse.json({ created, updated })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
