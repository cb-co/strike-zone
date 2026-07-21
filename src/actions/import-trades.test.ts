import { describe, it, expect, beforeEach, vi } from 'vitest'

// In-memory Prisma stand-in. Supports only the where/orderBy shapes importQfxTrades uses.
const h = vi.hoisted(() => {
  type Row = Record<string, unknown>
  const store: Row[] = []
  let seq = 1

  const toTime = (v: unknown) => (v instanceof Date ? v.getTime() : v)

  function matchField(actual: unknown, cond: unknown): boolean {
    if (cond === null) return actual === null || actual === undefined
    if (cond instanceof Date) return actual instanceof Date && actual.getTime() === cond.getTime()
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      for (const [op, val] of Object.entries(cond as Record<string, never>)) {
        switch (op) {
          case 'in':
            if (!(val as unknown[]).includes(actual)) return false
            break
          case 'hasSome':
            if (!Array.isArray(actual) || !(val as unknown[]).some((v) => actual.includes(v))) return false
            break
          case 'not':
            if (val === null) {
              if (actual === null || actual === undefined) return false
            } else if (actual === val) return false
            break
          case 'gte': if (!((toTime(actual) as number) >= (toTime(val) as number))) return false; break
          case 'lte': if (!((toTime(actual) as number) <= (toTime(val) as number))) return false; break
          case 'gt': if (!((toTime(actual) as number) > (toTime(val) as number))) return false; break
          case 'lt': if (!((toTime(actual) as number) < (toTime(val) as number))) return false; break
          default: throw new Error(`fake prisma: unsupported operator "${op}"`)
        }
      }
      return true
    }
    return actual === cond
  }

  const matches = (row: Row, where: Row = {}) =>
    Object.entries(where).every(([k, v]) => matchField(row[k], v))

  const sortRows = (rows: Row[], orderBy?: Record<string, 'asc' | 'desc'>) => {
    if (!orderBy) return rows
    const [[key, dir]] = Object.entries(orderBy)
    return [...rows].sort((a, b) => {
      const x = toTime(a[key]) as number, y = toTime(b[key]) as number
      return (x < y ? -1 : x > y ? 1 : 0) * (dir === 'desc' ? -1 : 1)
    })
  }

  const prisma = {
    account: {
      findFirst: vi.fn(async ({ where }: never) => ({ id: (where as Row).id, userId: (where as Row).userId })),
    },
    trade: {
      findFirst: vi.fn(async ({ where, orderBy }: never) => {
        const r = sortRows(store.filter((t) => matches(t, where)), orderBy)[0]
        return r ? { ...r } : null
      }),
      findMany: vi.fn(async ({ where, orderBy }: never) =>
        sortRows(store.filter((t) => matches(t, where)), orderBy).map((r) => ({ ...r }))),
      create: vi.fn(async ({ data }: never) => {
        const row: Row = { id: `t${seq++}`, closeDate: null, importFitIds: [], optionType: null, expiration: null, ...(data as Row) }
        store.push(row)
        return { ...row }
      }),
      update: vi.fn(async ({ where, data }: never) => {
        const row = store.find((t) => t.id === (where as Row).id)!
        Object.assign(row, data)
        return { ...row }
      }),
      updateMany: vi.fn(async ({ where, data }: never) => {
        const rows = store.filter((t) => matches(t, where))
        rows.forEach((r) => Object.assign(r, data))
        return { count: rows.length }
      }),
      deleteMany: vi.fn(async ({ where }: never) => {
        const keep = store.filter((t) => !matches(t, where))
        const count = store.length - keep.length
        store.length = 0
        store.push(...keep)
        return { count }
      }),
    },
  }

  return { store, prisma, reset: () => { store.length = 0; seq = 1 } }
})

vi.mock('@/lib/prisma', () => ({ prisma: h.prisma }))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: async () => ({ data: { user: { id: 'u1' } } }) } }),
}))
vi.mock('next/cache', () => ({ revalidatePath: () => {} }))

import { importQfxTrades, type ImportRecord } from './import-trades'

const ACCT = 'a1'

function seedStock(over: Record<string, unknown> = {}) {
  h.store.push({
    id: 'stock1', userId: 'u1', accountId: ACCT,
    name: 'ASTX', ticker: 'ASTX', symbol: 'ASTX', side: 'LONG',
    quantity: 400, entryPrice: 20, openDate: new Date('2026-05-01'),
    source: 'TS_IMPORT', optionType: null, strike: null, expiration: null,
    contractSize: 1, commission: 1, closeDate: null, netPnl: null,
    projectedProfit: null, importFitIds: [], importBatchId: null, closedByBatchId: null,
    ...over,
  })
}

function seedShortOption(optionType: 'PUT' | 'CALL', strike: number, expiration: string, over: Record<string, unknown> = {}) {
  h.store.push({
    id: `opt-${optionType}-${strike}`, userId: 'u1', accountId: ACCT,
    name: `ASTX ${optionType} $${strike}`, ticker: 'ASTX', symbol: `ASTX2607${optionType[0]}${strike}`,
    side: 'SHORT', quantity: 1, entryPrice: 2, openDate: new Date('2026-06-20'),
    source: 'TS_IMPORT', optionType, strike, expiration: new Date(expiration),
    contractSize: 100, commission: 0.65, closeDate: null, netPnl: null,
    projectedProfit: 200, importFitIds: [], importBatchId: null, closedByBatchId: null,
    ...over,
  })
}

function assignmentBuy(over: Partial<ImportRecord> = {}): ImportRecord {
  return {
    instrumentType: 'STOCK', symbol: 'ASTX', ticker: 'ASTX',
    quantity: 100, unitPrice: 50, commission: 5.95, date: '2026-07-10',
    action: 'BUY', netTotal: -5005.95, contractSize: 1,
    isAssignment: true, fitIds: ['3618641957/10/2026 12:00:00 AM'],
    ...over,
  }
}

const openStock = () =>
  h.store.filter((t) => t.ticker === 'ASTX' && t.optionType === null && t.closeDate === null)

beforeEach(() => h.reset())

describe('assignment stock leg merges into standing position', () => {
  it('put assignment adds to an existing open LONG instead of creating a second row', async () => {
    seedStock()                                    // 400 shares @ $20
    seedShortOption('PUT', 50, '2026-07-10')

    await importQfxTrades(ACCT, [assignmentBuy()], '2026-07-20')

    const rows = openStock()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].quantity)).toBe(500)
    // weighted average: (20*400 + 50*100) / 500
    expect(Number(rows[0].entryPrice)).toBe(26)
  })

  it('does not move the assignment fee onto the stock leg (it stays on the option)', async () => {
    seedStock()
    seedShortOption('PUT', 50, '2026-07-10')

    await importQfxTrades(ACCT, [assignmentBuy()], '2026-07-20')

    // stock commission untouched; the $5.95 was booked against the closed option
    expect(Number(openStock()[0].commission)).toBe(1)
    const opt = h.store.find((t) => t.id === 'opt-PUT-50')!
    expect(opt.closeDate).not.toBeNull()
    expect(Number(opt.commission)).toBe(0.65)
  })

  it('two assignments both merge — 400 + 100 + 100 = 600', async () => {
    seedStock()
    seedShortOption('PUT', 50, '2026-07-10')
    seedShortOption('PUT', 60, '2026-07-15')

    await importQfxTrades(ACCT, [
      assignmentBuy(),
      assignmentBuy({ quantity: 100, unitPrice: 60, date: '2026-07-15', fitIds: ['3624000407/15/2026 12:00:00 AM'] }),
    ], '2026-07-20')

    const rows = openStock()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].quantity)).toBe(600)
  })

  it('re-importing the same file does not inflate the position (FITID dedupe)', async () => {
    seedStock()
    seedShortOption('PUT', 50, '2026-07-10')

    await importQfxTrades(ACCT, [assignmentBuy()], '2026-07-20')
    await importQfxTrades(ACCT, [assignmentBuy()], '2026-07-20')

    const rows = openStock()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].quantity)).toBe(500)
  })
})

describe('previously-fixed edge cases still hold', () => {
  it('put assignment with no standing position still opens a new LONG at zero commission', async () => {
    seedShortOption('PUT', 50, '2026-07-10')

    await importQfxTrades(ACCT, [assignmentBuy()], '2026-07-20')

    const rows = openStock()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].quantity)).toBe(100)
    expect(Number(rows[0].entryPrice)).toBe(50)
    expect(Number(rows[0].commission)).toBe(0)
  })

  it('early assignment: matches a short option expiring within 7 days', async () => {
    seedStock()
    seedShortOption('PUT', 50, '2026-07-15')   // assigned 7/10, expires 7/15

    const res = await importQfxTrades(ACCT, [assignmentBuy()], '2026-07-12')

    expect(h.store.find((t) => t.id === 'opt-PUT-50')!.closeDate).not.toBeNull()
    expect(res.skipped).toHaveLength(0)
    expect(Number(openStock()[0].quantity)).toBe(500)
  })

  it('call assignment still delivers shares out of the standing position', async () => {
    seedStock()                                   // 400 @ $20
    seedShortOption('CALL', 40, '2026-07-17')

    await importQfxTrades(ACCT, [assignmentBuy({
      action: 'SELL', unitPrice: 40, quantity: 100, date: '2026-07-17',
      netTotal: 3994.05, fitIds: ['call-assign-1'],
    })], '2026-07-20')

    const rows = openStock()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].quantity)).toBe(300)    // 100 delivered away
  })

  it('a regular (non-assignment) buy still merges and does add its commission', async () => {
    seedStock()

    await importQfxTrades(ACCT, [assignmentBuy({
      unitPrice: 30, commission: 0.25, isAssignment: false, fitIds: ['plain-buy-1'],
    })], '2026-07-20')

    const rows = openStock()
    expect(rows).toHaveLength(1)
    expect(Number(rows[0].quantity)).toBe(500)
    expect(Number(rows[0].commission)).toBe(1.25)
  })
})
