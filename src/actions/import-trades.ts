'use server'

import { randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import { calcNetPnl } from '@/lib/trades'
import type { TradeSide, OptionType } from '@/generated/prisma/enums'

export type ImportRecord = {
  instrumentType: 'STOCK' | 'OPTION'
  symbol: string         // OCC symbol for options, ticker for stocks
  ticker: string
  optionType?: 'CALL' | 'PUT'
  strike?: number
  expiration?: string    // YYYY-MM-DD, options only
  quantity: number       // contracts for options, shares for stocks
  unitPrice: number
  commission: number     // actual commission paid on this transaction leg
  date: string           // YYYY-MM-DD
  action: 'BUY' | 'SELL' | 'SELLTOOPEN' | 'SELLTOCLOSE' | 'BUYTOOPEN' | 'BUYTOCLOSE'
  netTotal: number
  contractSize: number   // 100 for options, 1 for stocks
  isAssignment?: boolean // stock leg of an option assignment; commission = assignment fee
  fitIds: string[]       // QFX FITIDs — used to detect re-imports
}

export type ImportResult = {
  created: number
  closed: number
  expired: number
  skipped: string[]   // symbols with no open match
  errors: string[]
  batchId: string     // use with revertImport() to undo this import
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

// Returns both the no-space and with-space variants of an OCC symbol so lookups
// match regardless of how the symbol was stored (e.g. "SOXL260508P120" vs "SOXL 260508P120").
function symbolVariants(symbol: string): string[] {
  const noSpace = symbol.replace(/\s+/g, '')
  const withSpace = noSpace.replace(/^([A-Z]+)(\d)/, '$1 $2')
  return noSpace === withSpace ? [noSpace] : [noSpace, withSpace]
}

function tradeName(rec: ImportRecord): string {
  if (rec.instrumentType === 'STOCK') return rec.ticker
  // Parse expiration manually to avoid timezone issues
  const [, monthStr, dayStr] = (rec.expiration ?? '').split('-')
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
  records: ImportRecord[],
  dateRangeEnd: string,
): Promise<ImportResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  const account = await prisma.account.findFirst({
    where: { id: accountId, userId },
  })
  if (!account) throw new Error('Account not found')

  const batchId = randomUUID()

  // Sort chronologically; within the same date closes run before opens so a
  // close with no matching open gets skipped before the new open is created.
  const isClose = (r: ImportRecord) =>
    r.action === 'BUYTOCLOSE' || r.action === 'SELLTOCLOSE' || r.action === 'SELL' || !!r.isAssignment
  const sorted = [...records].sort((a, b) => {
    if (a.date < b.date) return -1
    if (a.date > b.date) return 1
    // same date: closes first
    return (isClose(a) ? 0 : 1) - (isClose(b) ? 0 : 1)
  })

  let created = 0
  let closed = 0
  let expired = 0
  const skipped: string[] = []
  const errors: string[] = []
  const deferred: ImportRecord[] = []

  // Symbols with an open on each date — so same-day intra-day open+close can be retried
  const sameDayOpens = new Set<string>()
  for (const rec of sorted) {
    if (!isClose(rec)) sameDayOpens.add(`${rec.date}|${rec.symbol.replace(/\s+/g, '')}`)
  }

  for (const rec of sorted) {
    // Assignment: stock leg of an option exercise — close the option with the assignment fee,
    // then record the stock at zero commission (fee already on the option side)
    if (rec.isAssignment) {
      // Skip assignments already stored on a prior run — re-importing the same file would
      // otherwise re-close the option and add the assigned shares to the position twice.
      if (rec.fitIds.length > 0) {
        const alreadyImported = await prisma.trade.findFirst({
          where: { userId, accountId, importFitIds: { hasSome: rec.fitIds } },
        })
        if (alreadyImported) {
          skipped.push(`${rec.ticker} assignment (duplicate)`)
          continue
        }
      }

      // BUY stock → short PUT was assigned; SELL stock → short CALL was assigned
      const assignedOptionType = rec.action === 'BUY' ? 'PUT' : 'CALL'
      const assignDate = new Date(rec.date)
      const earlyWindowEnd = new Date(assignDate)
      earlyWindowEnd.setDate(earlyWindowEnd.getDate() + 7)

      // Try exact expiration first; fall back to earliest-expiring option within
      // 7 days for early assignments (assigned before the official expiration date)
      let openOption = await prisma.trade.findFirst({
        where: {
          userId, accountId,
          ticker: rec.ticker,
          side: 'SHORT',
          optionType: assignedOptionType,
          closeDate: null,
          expiration: assignDate,
          strike: { gte: rec.unitPrice - 0.01, lte: rec.unitPrice + 0.01 },
        },
      })
      if (!openOption) {
        openOption = await prisma.trade.findFirst({
          where: {
            userId, accountId,
            ticker: rec.ticker,
            side: 'SHORT',
            optionType: assignedOptionType,
            closeDate: null,
            expiration: { gt: assignDate, lte: earlyWindowEnd },
            strike: { gte: rec.unitPrice - 0.01, lte: rec.unitPrice + 0.01 },
          },
          orderBy: { expiration: 'asc' },
        })
      }

      if (openOption) {
        const openCommission = Number(openOption.commission)
        const totalCommission = openCommission + rec.commission
        const netPnl = calcNetPnl({
          side: 'SHORT',
          entryPrice: Number(openOption.entryPrice),
          exitPrice: 0,
          quantity: Number(openOption.quantity),
          contractSize: openOption.contractSize,
          commission: totalCommission,
        })
        await prisma.trade.update({
          where: { id: openOption.id },
          data: { exitPrice: 0, closeDate: new Date(rec.date), netPnl, closedByBatchId: batchId },
        })
        closed++
      } else {
        skipped.push(`${rec.ticker} assignment (no matching open ${rec.action === 'BUY' ? 'PUT' : 'CALL'})`)
      }

      // Handle the stock leg — commission is $0 since the fee is already on the option
      if (rec.action === 'BUY') {
        // Short PUT assigned: you receive shares at strike. Merge into a standing LONG the
        // same way a regular buy does — assigned shares are an add to the existing lot, not
        // a separate position, so they must move the weighted-average cost basis.
        const openStock = await prisma.trade.findFirst({
          where: {
            userId, accountId,
            ticker: rec.ticker,
            side: 'LONG',
            optionType: null,
            expiration: null,
            closeDate: null,
          },
        })

        if (openStock) {
          const existingQty = Number(openStock.quantity)
          const newQty = existingQty + rec.quantity
          const newEntry = Math.round(
            ((Number(openStock.entryPrice) * existingQty) + (rec.unitPrice * rec.quantity)) / newQty * 100
          ) / 100
          await prisma.trade.update({
            where: { id: openStock.id },
            data: {
              quantity: newQty,
              entryPrice: newEntry,
              // commission stays as-is — the assignment fee is booked on the option leg
              importFitIds: [...openStock.importFitIds, ...rec.fitIds],
            },
          })
        } else {
          await prisma.trade.create({
            data: {
              userId,
              accountId,
              name: rec.ticker,
              ticker: rec.ticker,
              symbol: rec.ticker,
              side: 'LONG',
              quantity: rec.quantity,
              entryPrice: rec.unitPrice,
              openDate: new Date(rec.date),
              source: 'TS_IMPORT',
              contractSize: 1,
              commission: 0,
              importBatchId: batchId,
              importFitIds: rec.fitIds,
            },
          })
          created++
        }
      } else {
        // Short CALL assigned: you deliver shares at strike → close existing LONG position
        const openStock = await prisma.trade.findFirst({
          where: {
            userId, accountId,
            ticker: rec.ticker,
            side: 'LONG',
            optionType: null,
            expiration: null,
            closeDate: null,
          },
        })
        if (openStock) {
          const stockQty = Number(openStock.quantity)
          const closeQty = Math.min(rec.quantity, stockQty)
          const netPnl = calcNetPnl({
            side: 'LONG',
            entryPrice: Number(openStock.entryPrice),
            exitPrice: rec.unitPrice,
            quantity: closeQty,
            contractSize: 1,
            commission: 0,
          })
          if (closeQty >= stockQty) {
            await prisma.trade.update({
              where: { id: openStock.id },
              data: {
                exitPrice: rec.unitPrice,
                closeDate: new Date(rec.date),
                netPnl,
                closedByBatchId: batchId,
                importFitIds: [...openStock.importFitIds, ...rec.fitIds],
              },
            })
          } else {
            await prisma.trade.update({
              where: { id: openStock.id },
              data: { quantity: stockQty - closeQty, closedByBatchId: batchId },
            })
            await prisma.trade.create({
              data: {
                userId, accountId,
                name: openStock.name,
                ticker: openStock.ticker,
                symbol: openStock.symbol,
                side: 'LONG',
                quantity: closeQty,
                entryPrice: openStock.entryPrice,
                openDate: openStock.openDate,
                source: openStock.source,
                contractSize: 1,
                commission: 0,
                exitPrice: rec.unitPrice,
                closeDate: new Date(rec.date),
                netPnl,
                importBatchId: batchId,
                importFitIds: rec.fitIds,
              },
            })
          }
          closed++
        } else {
          // No tracked stock to deliver — the shares may have been in a prior period not yet imported.
          // Record a closed delivery at the assignment price so the event is auditable.
          await prisma.trade.create({
            data: {
              userId, accountId,
              name: rec.ticker,
              ticker: rec.ticker,
              symbol: rec.ticker,
              side: 'LONG',
              quantity: rec.quantity,
              entryPrice: rec.unitPrice,
              openDate: new Date(rec.date),
              source: 'TS_IMPORT',
              contractSize: 1,
              commission: 0,
              exitPrice: rec.unitPrice,
              closeDate: new Date(rec.date),
              importFitIds: rec.fitIds,
              netPnl: 0,
              importBatchId: batchId,
            },
          })
          closed++
        }
      }
      continue
    }

    const isOpenAction = rec.action === 'SELLTOOPEN' || rec.action === 'BUYTOOPEN' || rec.action === 'BUY'

    if (isOpenAction) {
      // Determine side
      let side: TradeSide
      if (rec.action === 'SELLTOOPEN') side = 'SHORT'
      else side = 'LONG' // BUYTOOPEN or BUY (stock)

      // Skip records whose FITIDs were already stored on any trade for this account
      if (rec.fitIds.length > 0) {
        const alreadyImported = await prisma.trade.findFirst({
          where: { userId, accountId, importFitIds: { hasSome: rec.fitIds } },
        })
        if (alreadyImported) {
          skipped.push(`${rec.symbol} (duplicate)`)
          continue
        }
      }

      const existing = await prisma.trade.findFirst({
        where: { userId, accountId, symbol: { in: symbolVariants(rec.symbol) }, closeDate: null, side },
      })

      if (existing) {
        // Add to position: weighted-average the entry price, accumulate quantity.
        // NOTE: this update is not tagged — add-to-position cannot be auto-reverted.
        const existingQty = Number(existing.quantity)
        const newQty = existingQty + rec.quantity
        const newEntry = Math.round(
          ((Number(existing.entryPrice) * existingQty) + (rec.unitPrice * rec.quantity)) / newQty * 100
        ) / 100
        const newProjectedProfit = existing.side === 'SHORT'
          ? newEntry * newQty * (existing.contractSize ?? 100)
          : null

        await prisma.trade.update({
          where: { id: existing.id },
          data: {
            quantity: newQty,
            entryPrice: newEntry,
            projectedProfit: newProjectedProfit,
            commission: Number(existing.commission) + rec.commission,
            importFitIds: [...existing.importFitIds, ...rec.fitIds],
          },
        })
      } else {
        if (rec.instrumentType === 'STOCK') {
          await prisma.trade.create({
            data: {
              userId,
              accountId,
              name: tradeName(rec),
              ticker: rec.ticker,
              symbol: rec.symbol,
              side: 'LONG',
              quantity: rec.quantity,
              entryPrice: rec.unitPrice,
              openDate: new Date(rec.date),
              source: 'TS_IMPORT',
              contractSize: 1,
              commission: rec.commission,
              importBatchId: batchId,
              importFitIds: rec.fitIds,
            },
          })
        } else {
          const projectedProfit = side === 'SHORT'
            ? rec.unitPrice * rec.quantity * rec.contractSize
            : null

          await prisma.trade.create({
            data: {
              userId,
              accountId,
              name: tradeName(rec),
              ticker: rec.ticker,
              symbol: rec.symbol,
              side,
              quantity: rec.quantity,
              entryPrice: rec.unitPrice,
              openDate: new Date(rec.date),
              source: 'TS_IMPORT',
              optionType: rec.optionType as OptionType,
              strike: rec.strike,
              expiration: new Date(rec.expiration!),
              contractSize: rec.contractSize,
              projectedProfit,
              commission: rec.commission,
              importBatchId: batchId,
              importFitIds: rec.fitIds,
            },
          })
        }
        created++
      }
      continue
    }

    // Close — determine which side we're closing
    let closingSide: TradeSide
    if (rec.action === 'BUYTOCLOSE') closingSide = 'SHORT'
    else closingSide = 'LONG' // SELLTOCLOSE or SELL (stock)

    // Close — quantity-aware, supports partial closes
    const openTrade = await prisma.trade.findFirst({
      where: { userId, accountId, symbol: { in: symbolVariants(rec.symbol) }, closeDate: null, side: closingSide },
    })

    if (!openTrade) {
      // If an open for this symbol exists later that same day, defer until after it's processed
      if (sameDayOpens.has(`${rec.date}|${rec.symbol.replace(/\s+/g, '')}`)) {
        deferred.push(rec)
      } else {
        skipped.push(rec.symbol)
      }
      continue
    }

    const tradeQty = Number(openTrade.quantity)

    // If the close wants more contracts than currently exist AND a same-day STO will add more,
    // defer so the open runs first (e.g. STO → BTC roll where STO augments before the BTC)
    if (rec.quantity > tradeQty && sameDayOpens.has(`${rec.date}|${rec.symbol.replace(/\s+/g, '')}`)) {
      deferred.push(rec)
      continue
    }

    const closeQty = Math.min(rec.quantity, tradeQty)

    // Pro-rate open commission if this is a partial close
    const openCommission = Number(openTrade.commission) * (closeQty / tradeQty)
    const totalCommission = openCommission + rec.commission

    const netPnl = calcNetPnl({
      side: openTrade.side as 'LONG' | 'SHORT',
      entryPrice: Number(openTrade.entryPrice),
      exitPrice: rec.unitPrice,
      quantity: closeQty,
      contractSize: openTrade.contractSize,
      commission: totalCommission,
    })

    if (closeQty >= tradeQty) {
      await prisma.trade.update({
        where: { id: openTrade.id },
        data: { exitPrice: rec.unitPrice, closeDate: new Date(rec.date), netPnl, closedByBatchId: batchId },
      })
    } else {
      // Partial close: shrink the open, create a closed record for the closed portion
      const remainingQty = tradeQty - closeQty
      const remainingCommission = Number(openTrade.commission) * (remainingQty / tradeQty)
      await prisma.trade.update({
        where: { id: openTrade.id },
        data: {
          quantity: remainingQty,
          commission: remainingCommission,
          projectedProfit: openTrade.projectedProfit != null
            ? Number(openTrade.projectedProfit) * (remainingQty / tradeQty)
            : null,
          closedByBatchId: batchId,
        },
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
          commission: openCommission,
          projectedProfit: openTrade.projectedProfit != null
            ? Number(openTrade.projectedProfit) * (closeQty / tradeQty)
            : null,
          exitPrice: rec.unitPrice,
          closeDate: new Date(rec.date),
          netPnl,
          importBatchId: batchId,
        },
      })
    }

    closed++
  }

  // Second pass: retry closes deferred because the matching open hadn't been processed yet
  // (intra-day open-then-close where the close appeared first in the sorted order)
  for (const rec of deferred) {
    let closingSide: TradeSide
    if (rec.action === 'BUYTOCLOSE') closingSide = 'SHORT'
    else closingSide = 'LONG'

    const openTrade = await prisma.trade.findFirst({
      where: { userId, accountId, symbol: { in: symbolVariants(rec.symbol) }, closeDate: null, side: closingSide },
    })

    if (!openTrade) {
      skipped.push(rec.symbol)
      continue
    }

    const tradeQty = Number(openTrade.quantity)
    const closeQty = Math.min(rec.quantity, tradeQty)
    const openCommission = Number(openTrade.commission) * (closeQty / tradeQty)
    const totalCommission = openCommission + rec.commission

    const netPnl = calcNetPnl({
      side: openTrade.side as 'LONG' | 'SHORT',
      entryPrice: Number(openTrade.entryPrice),
      exitPrice: rec.unitPrice,
      quantity: closeQty,
      contractSize: openTrade.contractSize,
      commission: totalCommission,
    })

    if (closeQty >= tradeQty) {
      await prisma.trade.update({
        where: { id: openTrade.id },
        data: { exitPrice: rec.unitPrice, closeDate: new Date(rec.date), netPnl, closedByBatchId: batchId },
      })
    } else {
      const remainingQty = tradeQty - closeQty
      const remainingCommission = Number(openTrade.commission) * (remainingQty / tradeQty)
      await prisma.trade.update({
        where: { id: openTrade.id },
        data: {
          quantity: remainingQty,
          commission: remainingCommission,
          projectedProfit: openTrade.projectedProfit != null
            ? Number(openTrade.projectedProfit) * (remainingQty / tradeQty)
            : null,
          closedByBatchId: batchId,
        },
      })
      await prisma.trade.create({
        data: {
          userId, accountId,
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
          commission: openCommission,
          projectedProfit: openTrade.projectedProfit != null
            ? Number(openTrade.projectedProfit) * (closeQty / tradeQty)
            : null,
          exitPrice: rec.unitPrice,
          closeDate: new Date(rec.date),
          netPnl,
          importBatchId: batchId,
        },
      })
    }
    closed++
  }

  // Auto-close options that expired within this file's date range and have no explicit close.
  // Using dateRangeEnd (file DTEND) instead of today prevents incorrectly closing positions
  // from future import periods when importing historical files.
  const rangeEnd = new Date(dateRangeEnd)
  const expiredTrades = await prisma.trade.findMany({
    where: {
      userId,
      accountId,
      closeDate: null,
      expiration: { lte: rangeEnd },
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
        closedByBatchId: batchId,
      },
    })
    expired++
  }

  revalidateTrades()

  return { created, closed, expired, skipped, errors, batchId }
}

export async function revertImport(batchId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  // Verify this batch belongs to this user before touching anything
  const owned = await prisma.trade.findFirst({ where: { userId, importBatchId: batchId } })
    ?? await prisma.trade.findFirst({ where: { userId, closedByBatchId: batchId } })
  if (!owned) throw new Error('Import batch not found')

  // Partial-close splits: created closed records where the corresponding open was shrunk.
  // Restore the remaining open's quantity before deleting the split record.
  const splits = await prisma.trade.findMany({
    where: { userId, importBatchId: batchId, closeDate: { not: null } },
    include: { account: true },
  })
  for (const split of splits) {
    const remaining = await prisma.trade.findFirst({
      where: {
        userId,
        accountId: split.accountId,
        symbol: split.symbol,
        side: split.side,
        closeDate: null,
        closedByBatchId: batchId,
      },
    })
    if (remaining) {
      // Recover the open-side commission that was pro-rated into the split record
      const closeRate = Number(split.account.commissionPerOption)
      const openCommissionInSplit = Number(split.commission) - Number(split.quantity) * closeRate
      await prisma.trade.update({
        where: { id: remaining.id },
        data: {
          quantity: Number(remaining.quantity) + Number(split.quantity),
          commission: Number(remaining.commission) + Math.max(0, openCommissionInSplit),
          projectedProfit: remaining.projectedProfit != null
            ? Number(remaining.projectedProfit) + (split.projectedProfit != null ? Number(split.projectedProfit) : 0)
            : null,
          closedByBatchId: null,
        },
      })
    }
  }

  // Revert existing trades that were fully closed or auto-expired by this import
  await prisma.trade.updateMany({
    where: { userId, closedByBatchId: batchId },
    data: { exitPrice: null, closeDate: null, netPnl: null, closedByBatchId: null },
  })

  // Delete all trades created by this import
  await prisma.trade.deleteMany({ where: { userId, importBatchId: batchId } })

  revalidateTrades()
}
