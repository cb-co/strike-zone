'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { calcNetPnl } from '@/lib/trades'
import type { TradeSide, OptionType, TradeSource } from '@/generated/prisma/enums'

async function getUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

const tradeSchema = z.object({
  accountId: z.string().uuid(),
  name: z.string().min(1),
  ticker: z.string().min(1).transform((v) => v.toUpperCase()),
  symbol: z.string().min(1).transform((v) => v.toUpperCase()),
  side: z.enum(['LONG', 'SHORT']),
  quantity: z.coerce.number().positive(),
  entryPrice: z.coerce.number().positive(),
  openDate: z.string().min(1), // ISO date string
  instrumentId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  projectedProfit: z.coerce.number().optional().nullable(),
  // Option fields — only present when it's an option trade
  optionType: z.enum(['CALL', 'PUT']).optional().nullable(),
  strike: z.coerce.number().optional().nullable(),
  expiration: z.string().optional().nullable(), // ISO date string
  contractSize: z.coerce.number().int().optional().nullable(),
  // Close fields
  exitPrice: z.coerce.number().optional().nullable(),
  closeDate: z.string().optional().nullable(),
})

function revalidateTrades() {
  revalidatePath('/trades', 'page')
  revalidatePath('/dashboard', 'page')
  revalidatePath('/monthly', 'page')
  revalidatePath('/goals', 'page')
}

export async function createTrade(formData: FormData) {
  const userId = await getUserId()
  const raw = Object.fromEntries(formData)
  const data = tradeSchema.parse(raw)

  // Validate: options require strike and expiration
  if (data.optionType && (!data.strike || !data.expiration)) {
    throw new Error('Options require strike price and expiration date')
  }

  await prisma.trade.create({
    data: {
      userId,
      accountId: data.accountId,
      name: data.name,
      ticker: data.ticker,
      symbol: data.symbol,
      side: data.side as TradeSide,
      quantity: data.quantity,
      entryPrice: data.entryPrice,
      openDate: new Date(data.openDate),
      source: 'MANUAL' as TradeSource,
      notes: data.notes ?? null,
      projectedProfit: data.projectedProfit ?? null,
      instrumentId: data.instrumentId ?? null,
      optionType: (data.optionType ?? null) as OptionType | null,
      strike: data.strike ?? null,
      expiration: data.expiration ? new Date(data.expiration) : null,
      contractSize: data.contractSize ?? null,
    },
  })

  revalidateTrades()
}

export async function updateTrade(id: string, formData: FormData) {
  const userId = await getUserId()
  const raw = Object.fromEntries(formData)
  const data = tradeSchema.parse(raw)

  if (data.optionType && (!data.strike || !data.expiration)) {
    throw new Error('Options require strike price and expiration date')
  }

  // If closing the trade, compute netPnl
  let netPnl: number | null = null
  if (data.exitPrice && data.closeDate) {
    netPnl = calcNetPnl({
      side: data.side,
      entryPrice: data.entryPrice,
      exitPrice: data.exitPrice,
      quantity: data.quantity,
      contractSize: data.contractSize,
    })
  }

  await prisma.trade.update({
    where: { id, userId },
    data: {
      accountId: data.accountId,
      name: data.name,
      ticker: data.ticker,
      symbol: data.symbol,
      side: data.side as TradeSide,
      quantity: data.quantity,
      entryPrice: data.entryPrice,
      openDate: new Date(data.openDate),
      notes: data.notes ?? null,
      projectedProfit: data.projectedProfit ?? null,
      instrumentId: data.instrumentId ?? null,
      optionType: (data.optionType ?? null) as OptionType | null,
      strike: data.strike ?? null,
      expiration: data.expiration ? new Date(data.expiration) : null,
      contractSize: data.contractSize ?? null,
      exitPrice: data.exitPrice ?? null,
      closeDate: data.closeDate ? new Date(data.closeDate) : null,
      netPnl: netPnl,
    },
  })

  revalidateTrades()
}

export async function deleteTrade(id: string) {
  const userId = await getUserId()
  await prisma.trade.delete({ where: { id, userId } })
  revalidateTrades()
}

export async function closeTrade(id: string, exitPrice: number, closeDate: string) {
  const userId = await getUserId()
  const trade = await prisma.trade.findUnique({ where: { id, userId } })
  if (!trade) throw new Error('Trade not found')

  const netPnl = calcNetPnl({
    side: trade.side,
    entryPrice: Number(trade.entryPrice),
    exitPrice,
    quantity: Number(trade.quantity),
    contractSize: trade.contractSize,
  })

  await prisma.trade.update({
    where: { id, userId },
    data: {
      exitPrice,
      closeDate: new Date(closeDate),
      netPnl,
    },
  })

  revalidateTrades()
}

export async function addSetupToTrade(tradeId: string, setupId: string) {
  const userId = await getUserId()
  // Verify trade belongs to user
  const trade = await prisma.trade.findUnique({ where: { id: tradeId, userId } })
  if (!trade) throw new Error('Trade not found')

  await prisma.tradeSetup.upsert({
    where: { tradeId_setupId: { tradeId, setupId } },
    create: { tradeId, setupId },
    update: {},
  })
  revalidateTrades()
}

export async function removeSetupFromTrade(tradeId: string, setupId: string) {
  const userId = await getUserId()
  const trade = await prisma.trade.findUnique({ where: { id: tradeId, userId } })
  if (!trade) throw new Error('Trade not found')

  await prisma.tradeSetup.delete({
    where: { tradeId_setupId: { tradeId, setupId } },
  })
  revalidateTrades()
}
