import { Suspense } from 'react'
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { TradesTable, type TableTrade } from '@/components/trades-table'
import { CalendarTab } from '@/components/calendar-tab'
import { ByTickerTab } from '@/components/by-ticker-tab'
import { BySetupsTab } from '@/components/by-setups-tab'
import { AddTradeButton } from '@/components/add-trade-button'
import { ImportQfxButton } from '@/components/import-qfx-button'
import { DeleteAllTradesButton } from '@/components/delete-all-trades-button'
import { TradesTabsClient } from '@/components/trades-tabs-client'
import { calcOpenRisk } from '@/lib/trades'

type Props = {
  searchParams?: Promise<Record<string, string | string[]>>
}

function normalizeTradeList(raw: Parameters<typeof normalizeOne>[0][]): TableTrade[] {
  return raw.map(normalizeOne)
}

function normalizeOne(t: {
  id: string
  name: string
  ticker: string
  symbol: string
  side: string
  quantity: unknown
  entryPrice: unknown
  openDate: Date
  source: string
  exitPrice: unknown
  closeDate: Date | null
  projectedProfit: unknown
  netPnl: unknown
  notes: string | null
  optionType: string | null
  strike: unknown
  expiration: Date | null
  contractSize: number | null
  commission: unknown
  accountId: string
  tradeSetups: { setupId: string; setup: { name: string } }[]
}): TableTrade {
  return {
    ...t,
    side: t.side as 'LONG' | 'SHORT',
    source: t.source as 'MANUAL' | 'TS_IMPORT',
    optionType: t.optionType as 'CALL' | 'PUT' | null,
    quantity: Number(t.quantity),
    entryPrice: Number(t.entryPrice),
    exitPrice: t.exitPrice != null ? Number(t.exitPrice) : null,
    projectedProfit: t.projectedProfit != null ? Number(t.projectedProfit) : null,
    netPnl: t.netPnl != null ? Number(t.netPnl) : null,
    strike: t.strike != null ? Number(t.strike) : null,
    commission: Number(t.commission),
    tradeSetups: t.tradeSetups.map((ts) => ({ setupId: ts.setupId, setup: { name: ts.setup.name } })),
  }
}

export default async function TradesPage(props: Props) {
  const searchParams = await props.searchParams
  const tab = (searchParams?.tab as string) ?? 'open'
  const page = Math.max(1, parseInt((searchParams?.page as string) ?? '1'))
  const perPage = Math.max(1, Math.min(100, parseInt((searchParams?.perPage as string) ?? '20')))
  const q = ((searchParams?.q as string) ?? '').trim()
  const tickersParam = ((searchParams?.tickers as string) ?? '').trim()
  const selectedTickers = tickersParam ? tickersParam.split(',').filter(Boolean) : []
  const dateFrom = ((searchParams?.dateFrom as string) ?? '').trim()
  const dateTo = ((searchParams?.dateTo as string) ?? '').trim()

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [accounts, setups] = await Promise.all([
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true, optionAssignmentFee: true } })
      .then(accs => accs.map(a => ({ ...a, optionAssignmentFee: Number(a.optionAssignmentFee) }))),
    prisma.setup.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ])

  // Tab counts (always needed for the nav)
  const [openCount, closedCount, lossesCount] = await Promise.all([
    prisma.trade.count({ where: { userId: user.id, closeDate: null } }),
    prisma.trade.count({ where: { userId: user.id, closeDate: { not: null } } }),
    prisma.trade.count({ where: { userId: user.id, closeDate: { not: null }, netPnl: { lt: 0 } } }),
  ])

  const searchOR = q
    ? [
        { ticker: { contains: q, mode: 'insensitive' as const } },
        { name: { contains: q, mode: 'insensitive' as const } },
        { symbol: { contains: q, mode: 'insensitive' as const } },
      ]
    : undefined

  // Build date filter for closeDate
  function buildDateFilter() {
    if (!dateFrom && !dateTo) return undefined
    const filter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) filter.gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setUTCHours(23, 59, 59, 999)
      filter.lte = end
    }
    return filter
  }

  // Build date filter for openDate (open trades)
  function buildOpenDateFilter() {
    if (!dateFrom && !dateTo) return undefined
    const filter: { gte?: Date; lte?: Date } = {}
    if (dateFrom) filter.gte = new Date(dateFrom)
    if (dateTo) {
      const end = new Date(dateTo)
      end.setUTCHours(23, 59, 59, 999)
      filter.lte = end
    }
    return filter
  }

  let content: React.ReactNode
  let availableTickers: string[] = []

  if (tab === 'open') {
    const openBase: Record<string, unknown> = { userId: user.id, closeDate: null }
    if (selectedTickers.length > 0) openBase.ticker = { in: selectedTickers }
    const openDateFilter = buildOpenDateFilter()
    if (openDateFilter) openBase.openDate = openDateFilter
    const openWhere = searchOR ? { ...openBase, OR: searchOR } : openBase

    const [rawTrades, total, agg, riskTrades, tickerRows] = await Promise.all([
      prisma.trade.findMany({
        where: openWhere,
        include: { tradeSetups: { include: { setup: true } } },
        orderBy: { openDate: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.trade.count({ where: openWhere }),
      prisma.trade.aggregate({ _sum: { projectedProfit: true }, where: openWhere }),
      prisma.trade.findMany({
        where: { userId: user.id, closeDate: null },
        select: { side: true, entryPrice: true, quantity: true, contractSize: true, optionType: true, strike: true },
      }),
      prisma.trade.findMany({
        where: { userId: user.id, closeDate: null },
        select: { ticker: true },
        distinct: ['ticker'],
        orderBy: { ticker: 'asc' },
      }),
    ])

    availableTickers = tickerRows.map(r => r.ticker)

    const openRisk = calcOpenRisk(riskTrades.map(t => ({
      side: t.side,
      optionType: t.optionType,
      entryPrice: Number(t.entryPrice),
      quantity: Number(t.quantity),
      contractSize: t.contractSize,
      strike: t.strike ? Number(t.strike) : null,
    })))

    content = (
      <>
        <div className="mb-2 text-sm text-muted-foreground">
          Open Risk: <span className="font-medium">${openRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
        </div>
        <Suspense>
          <TradesTable
            trades={normalizeTradeList(rawTrades)}
            variant="open"
            accounts={accounts}
            setups={setups}
            total={total}
            page={page}
            perPage={perPage}
            projProfitTotal={Number(agg._sum.projectedProfit ?? 0)}
            availableTickers={availableTickers}
          />
        </Suspense>
      </>
    )
  } else if (tab === 'closed') {
    const closedBase: Record<string, unknown> = { userId: user.id, closeDate: { not: null } }
    if (selectedTickers.length > 0) closedBase.ticker = { in: selectedTickers }
    const dateFilter = buildDateFilter()
    if (dateFilter) closedBase.closeDate = { ...closedBase.closeDate as object, ...dateFilter }
    const closedWhere = searchOR ? { ...closedBase, OR: searchOR } : closedBase

    const [rawTrades, total, agg, tickerRows] = await Promise.all([
      prisma.trade.findMany({
        where: closedWhere,
        include: { tradeSetups: { include: { setup: true } } },
        orderBy: { closeDate: 'desc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.trade.count({ where: closedWhere }),
      prisma.trade.aggregate({ _sum: { netPnl: true }, where: closedWhere }),
      prisma.trade.findMany({
        where: { userId: user.id, closeDate: { not: null } },
        select: { ticker: true },
        distinct: ['ticker'],
        orderBy: { ticker: 'asc' },
      }),
    ])

    availableTickers = tickerRows.map(r => r.ticker)

    content = (
      <Suspense>
        <TradesTable
          trades={normalizeTradeList(rawTrades)}
          variant="closed"
          accounts={accounts}
          setups={setups}
          total={total}
          page={page}
          perPage={perPage}
          netPnlTotal={Number(agg._sum.netPnl ?? 0)}
          availableTickers={availableTickers}
        />
      </Suspense>
    )
  } else if (tab === 'losses') {
    const lossBase: Record<string, unknown> = { userId: user.id, closeDate: { not: null }, netPnl: { lt: 0 } }
    if (selectedTickers.length > 0) lossBase.ticker = { in: selectedTickers }
    const dateFilter = buildDateFilter()
    if (dateFilter) lossBase.closeDate = { ...lossBase.closeDate as object, ...dateFilter }
    const lossWhere = searchOR ? { ...lossBase, OR: searchOR } : lossBase

    const [rawTrades, total, agg, tickerRows] = await Promise.all([
      prisma.trade.findMany({
        where: lossWhere,
        include: { tradeSetups: { include: { setup: true } } },
        orderBy: { netPnl: 'asc' },
        skip: (page - 1) * perPage,
        take: perPage,
      }),
      prisma.trade.count({ where: lossWhere }),
      prisma.trade.aggregate({ _sum: { netPnl: true }, where: lossWhere }),
      prisma.trade.findMany({
        where: { userId: user.id, closeDate: { not: null }, netPnl: { lt: 0 } },
        select: { ticker: true },
        distinct: ['ticker'],
        orderBy: { ticker: 'asc' },
      }),
    ])

    availableTickers = tickerRows.map(r => r.ticker)

    content = (
      <Suspense>
        <TradesTable
          trades={normalizeTradeList(rawTrades)}
          variant="losses"
          accounts={accounts}
          setups={setups}
          total={total}
          page={page}
          perPage={perPage}
          netPnlTotal={Number(agg._sum.netPnl ?? 0)}
          availableTickers={availableTickers}
        />
      </Suspense>
    )
  } else {
    // calendar, by-ticker, by-setups — fetch all closed trades for aggregation
    const rawAllClosed = await prisma.trade.findMany({
      where: { userId: user.id, closeDate: { not: null } },
      include: { tradeSetups: { include: { setup: true } } },
      orderBy: { closeDate: 'desc' },
    })
    const allClosed = normalizeTradeList(rawAllClosed)
    const month = parseInt((searchParams?.month as string) ?? String(new Date().getMonth() + 1))
    const year = parseInt((searchParams?.year as string) ?? String(new Date().getFullYear()))

    if (tab === 'calendar') {
      content = <CalendarTab trades={allClosed} month={month} year={year} />
    } else if (tab === 'by-ticker') {
      content = <ByTickerTab trades={allClosed} />
    } else {
      content = <BySetupsTab trades={allClosed} />
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trades</h1>
        <div className="flex items-center gap-2">
          <DeleteAllTradesButton />
          <ImportQfxButton accounts={accounts} />
          <AddTradeButton accounts={accounts} setups={setups} />
        </div>
      </div>

      <Suspense fallback={
        <div className="inline-flex h-9 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground gap-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 w-20 rounded-md bg-muted-foreground/10 animate-pulse" />
          ))}
        </div>
      }>
        <TradesTabsClient tab={tab} counts={{ open: openCount, closed: closedCount, losses: lossesCount }}>
          {content}
        </TradesTabsClient>
      </Suspense>
    </div>
  )
}
