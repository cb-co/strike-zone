'use server'

import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { calcNetPnl } from '@/lib/trades'
import type { TradeSide, OptionType } from '@/generated/prisma/enums'

export type ImportRecord = {
  symbol: string
  ticker: string
  optionType: 'CALL' | 'PUT'
  strike: number
  expiration: string         // YYYY-MM-DD
  contracts: number
  unitPrice: number
  date: string               // YYYY-MM-DD
  action: 'SELLTOOPEN' | 'SELLTOCLOSE' | 'BUYTOOPEN' | 'BUYTOCLOSE'
  netTotal: number
  contractSize: number
}

export type ImportResult = {
  created: number
  closed: number
  skipped: number
  errors: string[]
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function tradeName(rec: ImportRecord): string {
  // Parse expiration manually to avoid timezone issues
  const [, monthStr, dayStr] = rec.expiration.split('-')
  const monthIndex = parseInt(monthStr, 10) - 1
  const day = parseInt(dayStr, 10)
  const monthName = MONTH_NAMES[monthIndex] ?? monthStr
  return `${rec.ticker} ${rec.optionType} $${rec.strike} ${monthName} ${day}`
}

function revalidateTrades(): void {
  revalidatePath('/trades')
  revalidatePath('/dashboard')
  revalidatePath('/monthly')
  revalidatePath('/goals')
}

export async function importQfxTrades(
  accountId: string,
  records: ImportRecord[]
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  })
  if (!account) throw new Error('Account not found')

  const opens = records.filter(r => r.action === 'SELLTOOPEN' || r.action === 'BUYTOOPEN')
  const closes = records.filter(r => r.action === 'BUYTOCLOSE' || r.action === 'SELLTOCLOSE')

  let created = 0
  let closed = 0
  let skipped = 0
  const errors: string[] = []

  // Process opens first
  for (const rec of opens) {
    const existing = await prisma.trade.findFirst({
      where: {
        userId,
        accountId,
        symbol: rec.symbol,
        openDate: new Date(rec.date),
        entryPrice: rec.unitPrice,
      },
    })
    if (existing) {
      skipped++
      continue
    }

    const side: TradeSide = rec.action === 'SELLTOOPEN' ? 'SHORT' : 'LONG'
    const projectedProfit =
      side === 'SHORT'
        ? rec.unitPrice * rec.contracts * rec.contractSize
        : null

    await prisma.trade.create({
      data: {
        userId,
        accountId,
        name: tradeName(rec),
        ticker: rec.ticker,
        symbol: rec.symbol,
        side,
        quantity: rec.contracts,
        entryPrice: rec.unitPrice,
        openDate: new Date(rec.date),
        source: 'TS_IMPORT',
        optionType: rec.optionType as OptionType,
        strike: rec.strike,
        expiration: new Date(rec.expiration),
        contractSize: rec.contractSize,
        projectedProfit,
      },
    })
    created++
  }

  // Process closes next
  for (const rec of closes) {
    const openTrade = await prisma.trade.findFirst({
      where: {
        userId,
        accountId,
        symbol: rec.symbol,
        closeDate: null,
      },
      orderBy: { openDate: 'desc' },
    })

    if (!openTrade) {
      skipped++
      continue
    }

    const netPnl = calcNetPnl({
      side: openTrade.side as 'LONG' | 'SHORT',
      entryPrice: Number(openTrade.entryPrice),
      exitPrice: rec.unitPrice,
      quantity: Number(openTrade.quantity),
      contractSize: openTrade.contractSize,
    })

    await prisma.trade.update({
      where: { id: openTrade.id },
      data: {
        exitPrice: rec.unitPrice,
        closeDate: new Date(rec.date),
        netPnl,
      },
    })
    closed++
  }

  revalidateTrades()

  return { created, closed, skipped, errors: [] }
}
