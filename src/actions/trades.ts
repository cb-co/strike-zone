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

  if (data.optionType && (!data.strike || !data.expiration)) {
    throw new Error('Options require strike price and expiration date')
  }

  const account = await prisma.account.findFirst({ where: { id: data.accountId, userId } })
  if (!account) throw new Error('Account not found')

  const commissionRate = data.optionType
    ? Number(account.commissionPerOption)
    : Number(account.commissionPerStock)
  const commission = data.quantity * commissionRate

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
      commission,
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

  // Preserve existing close data — edit form no longer contains close fields
  const existing = await prisma.trade.findUnique({
    where: { id, userId },
    select: { exitPrice: true, closeDate: true, netPnl: true },
  })

  let exitPrice = existing?.exitPrice ?? null
  let closeDate = existing?.closeDate ?? null
  let netPnl = existing?.netPnl ?? null

  if (data.closeDate) {
    closeDate = new Date(data.closeDate) as unknown as typeof closeDate
    if (data.exitPrice) {
      const computed = calcNetPnl({
        side: data.side,
        entryPrice: data.entryPrice,
        exitPrice: data.exitPrice,
        quantity: data.quantity,
        contractSize: data.contractSize,
      })
      exitPrice = data.exitPrice as unknown as typeof exitPrice
      netPnl = computed as unknown as typeof netPnl
    }
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
      exitPrice,
      closeDate,
      netPnl,
    },
  })

  revalidateTrades()
}

export async function deleteTrade(id: string) {
  const userId = await getUserId()
  await prisma.trade.delete({ where: { id, userId } })
  revalidateTrades()
}

export async function updateCloseDate(id: string, closeDate: string) {
  const userId = await getUserId()
  await prisma.trade.update({
    where: { id, userId },
    data: { closeDate: new Date(closeDate) },
  })
  revalidateTrades()
}

export async function closeTrade(id: string, exitPrice: number, closeDate: string, isAssignment = false) {
  const userId = await getUserId()
  const trade = await prisma.trade.findUnique({
    where: { id, userId },
    include: { account: true },
  })
  if (!trade) throw new Error('Trade not found')

  const closeRate = trade.optionType
    ? Number(trade.account.commissionPerOption)
    : Number(trade.account.commissionPerStock)
  const closeCommission = Number(trade.quantity) * closeRate
  const assignmentFee = isAssignment ? Number(trade.account.optionAssignmentFee) : 0
  const totalCommission = Number(trade.commission) + closeCommission + assignmentFee

  const netPnl = calcNetPnl({
    side: trade.side,
    entryPrice: Number(trade.entryPrice),
    exitPrice,
    quantity: Number(trade.quantity),
    contractSize: trade.contractSize,
    commission: totalCommission,
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

const rollSchema = z.object({
  netCredit: z.coerce.number(), // positive = credit received, negative = debit paid
  rollDate: z.string().min(1),
  newEntryPrice: z.coerce.number().positive(),
  newStrike: z.coerce.number().optional().nullable(),
  newExpiration: z.string().min(1).optional().nullable(),
  newContractSize: z.coerce.number().int().optional().nullable(),
})

function buildOccSymbol(ticker: string, expiration: Date, optionType: string, strike: number): string {
  const yy = String(expiration.getUTCFullYear()).slice(2)
  const mm = String(expiration.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(expiration.getUTCDate()).padStart(2, '0')
  const cp = optionType === 'CALL' ? 'C' : 'P'
  return `${ticker}${yy}${mm}${dd}${cp}${strike}`
}

export async function rollTrade(id: string, formData: FormData) {
  const userId = await getUserId()
  const raw = Object.fromEntries(formData)
  const data = rollSchema.parse(raw)

  const original = await prisma.trade.findUnique({
    where: { id, userId },
    include: { account: true },
  })
  if (!original) throw new Error('Trade not found')

  const contractSize = data.newContractSize ?? original.contractSize
  const qty = Number(original.quantity)
  const mult = contractSize ?? 1

  const exitPrice =
    original.side === 'SHORT'
      ? data.newEntryPrice - data.netCredit
      : data.newEntryPrice + data.netCredit

  // Roll = close original + open new: two commission legs on original trade
  const closeCommission = qty * Number(original.account.commissionPerOption)
  const totalCommission = Number(original.commission) + closeCommission

  const netPnl = calcNetPnl({
    side: original.side,
    entryPrice: Number(original.entryPrice),
    exitPrice,
    quantity: qty,
    contractSize: original.contractSize,
    commission: totalCommission,
  })

  const projectedProfit =
    original.side === 'SHORT' && contractSize
      ? data.newEntryPrice * qty * contractSize
      : null

  await prisma.$transaction([
    prisma.trade.update({
      where: { id, userId },
      data: {
        exitPrice,
        closeDate: new Date(data.rollDate),
        netPnl,
      },
    }),
    prisma.trade.create({
      data: {
        userId,
        accountId: original.accountId,
        name: original.name + ' →Roll',
        ticker: original.ticker,
        symbol: buildOccSymbol(
          original.ticker,
          data.newExpiration ? new Date(data.newExpiration) : original.expiration!,
          original.optionType!,
          data.newStrike ?? Number(original.strike),
        ),
        side: original.side,
        quantity: qty,
        entryPrice: data.newEntryPrice,
        openDate: new Date(data.rollDate),
        source: 'MANUAL',
        notes: original.notes,
        instrumentId: original.instrumentId,
        optionType: original.optionType,
        strike: data.newStrike ?? original.strike,
        expiration: data.newExpiration ? new Date(data.newExpiration) : original.expiration,
        contractSize,
        projectedProfit,
      },
    }),
  ])

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

export async function deleteAllTrades() {
  const userId = await getUserId()
  await prisma.trade.deleteMany({ where: { userId } })
  revalidateTrades()
}
