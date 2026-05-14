import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TradesTable, type TableTrade } from '@/components/trades-table'
import { CalendarTab } from '@/components/calendar-tab'
import { ByTickerTab } from '@/components/by-ticker-tab'
import { BySetupsTab } from '@/components/by-setups-tab'
import { AddTradeButton } from '@/components/add-trade-button'
import { calcOpenRisk } from '@/lib/trades'

type Props = {
  searchParams?: Promise<Record<string, string | string[]>>
}

export default async function TradesPage(props: Props) {
  const searchParams = await props.searchParams
  const tab = (searchParams?.tab as string) ?? 'open'
  const month = parseInt((searchParams?.month as string) ?? String(new Date().getMonth() + 1))
  const year = parseInt((searchParams?.year as string) ?? String(new Date().getFullYear()))

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const [rawTrades, accounts, setups] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: user.id },
      include: { tradeSetups: { include: { setup: true } } },
      orderBy: { openDate: 'desc' },
    }),
    prisma.account.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
    prisma.setup.findMany({ where: { userId: user.id }, select: { id: true, name: true } }),
  ])

  // Normalize Decimal → number for client components
  const trades: TableTrade[] = rawTrades.map((t) => ({
    ...t,
    quantity: Number(t.quantity),
    entryPrice: Number(t.entryPrice),
    exitPrice: t.exitPrice ? Number(t.exitPrice) : null,
    projectedProfit: t.projectedProfit ? Number(t.projectedProfit) : null,
    netPnl: t.netPnl ? Number(t.netPnl) : null,
    strike: t.strike ? Number(t.strike) : null,
    tradeSetups: t.tradeSetups.map((ts) => ({
      setupId: ts.setupId,
      setup: { name: ts.setup.name },
    })),
  }))

  const openTrades = trades.filter((t) => !t.closeDate)
  const closedTrades = trades.filter((t) => !!t.closeDate)
  const openRisk = calcOpenRisk(openTrades.map((t) => ({
    side: t.side,
    optionType: t.optionType,
    entryPrice: t.entryPrice,
    quantity: t.quantity,
    contractSize: t.contractSize,
    strike: t.strike,
  })))

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Trades</h1>
        <AddTradeButton accounts={accounts} setups={setups}  />
      </div>

      <Tabs defaultValue={tab}>
        <TabsList>
          <TabsTrigger value="open">Open ({openTrades.length})</TabsTrigger>
          <TabsTrigger value="closed">Closed ({closedTrades.length})</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="by-ticker">By Ticker</TabsTrigger>
          <TabsTrigger value="by-setups">Setups</TabsTrigger>
          <TabsTrigger value="losses">Losses</TabsTrigger>
        </TabsList>

        <TabsContent value="open">
          <div className="mb-2 text-sm text-muted-foreground">
            Open Risk: <span className="font-medium">${openRisk.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
          </div>
          <TradesTable trades={openTrades} variant="open" accounts={accounts} setups={setups}  />
        </TabsContent>

        <TabsContent value="closed">
          <TradesTable trades={closedTrades} variant="closed" accounts={accounts} setups={setups}  />
        </TabsContent>

        <TabsContent value="calendar">
          <CalendarTab trades={closedTrades} month={month} year={year} />
        </TabsContent>

        <TabsContent value="by-ticker">
          <ByTickerTab trades={closedTrades} />
        </TabsContent>

        <TabsContent value="by-setups">
          <BySetupsTab trades={closedTrades} />
        </TabsContent>

        <TabsContent value="losses">
          <TradesTable trades={closedTrades} variant="losses" accounts={accounts} setups={setups}  />
        </TabsContent>
      </Tabs>
    </div>
  )
}
