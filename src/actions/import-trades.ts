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
  expired: number
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
  let expired = 0
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

  // Process closes next — FIFO, quantity-aware
  // One close record can span multiple open records (e.g. two 1-lot opens closed together).
  // Partial closes (close fewer contracts than an open trade holds) split the trade.
  for (const rec of closes) {
    const openTrades = await prisma.trade.findMany({
      where: { userId, accountId, symbol: rec.symbol, closeDate: null },
      orderBy: { openDate: 'asc' },
    })

    if (openTrades.length === 0) {
      skipped++
      continue
    }

    let remaining = rec.contracts

    for (const openTrade of openTrades) {
      if (remaining <= 0) break

      const tradeQty = Number(openTrade.quantity)
      const closeQty = Math.min(tradeQty, remaining)
      remaining -= closeQty

      const netPnl = calcNetPnl({
        side: openTrade.side as 'LONG' | 'SHORT',
        entryPrice: Number(openTrade.entryPrice),
        exitPrice: rec.unitPrice,
        quantity: closeQty,
        contractSize: openTrade.contractSize,
      })

      if (closeQty === tradeQty) {
        await prisma.trade.update({
          where: { id: openTrade.id },
          data: { exitPrice: rec.unitPrice, closeDate: new Date(rec.date), netPnl },
        })
      } else {
        // Partial close: shrink the open, create a new closed record for the closed portion
        await prisma.trade.update({
          where: { id: openTrade.id },
          data: { quantity: tradeQty - closeQty },
        })
        await prisma.trade.create({
          data: {
            userId,
            accountId,
            name: openTrade.name,
            ticker: openTrade.ticker,
            symbol: openTrade.symbol,
            side: openTrade.side,
            quantity: closeQty,
            entryPrice: openTrade.entryPrice,
            openDate: openTrade.openDate,
            source: openTrade.source,
            optionType: openTrade.optionType,
            strike: openTrade.strike,
            expiration: openTrade.expiration,
            contractSize: openTrade.contractSize,
            projectedProfit: openTrade.projectedProfit != null
              ? Number(openTrade.projectedProfit) * (closeQty / tradeQty)
              : null,
            exitPrice: rec.unitPrice,
            closeDate: new Date(rec.date),
            netPnl,
          },
        })
      }

      closed++
    }
  }

  // Auto-close options that expired worthless (SHORT = expires at 0 profit, LONG = full loss)
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)
  const expiredTrades = await prisma.trade.findMany({
    where: {
      userId,
      accountId,
      closeDate: null,
      expiration: { lt: today },
      optionType: { not: null },
    },
  })
  for (const trade of expiredTrades) {
    const netPnl = calcNetPnl({
      side: trade.side as 'LONG' | 'SHORT',
      entryPrice: Number(trade.entryPrice),
      exitPrice: 0,
      quantity: Number(trade.quantity),
      contractSize: trade.contractSize,
    })
    await prisma.trade.update({
      where: { id: trade.id },
      data: {
        exitPrice: 0,
        closeDate: trade.expiration,
        netPnl,
      },
    })
    expired++
  }

  revalidateTrades()

  return { created, closed, expired, skipped, errors: [] }
}
