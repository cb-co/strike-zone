import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { calcOpenRisk } from "@/lib/trades";
import { expectedCumPnL, monthlyBreakdown } from "@/lib/goals";
import { EquityChart, type EquityDataPoint } from "@/components/equity-chart";
import Link from "next/link";
import {
  DashboardOpenPositions,
  type BoardTotal,
  type DashboardPosition,
} from "@/components/dashboard-open-positions";
import { PageHeader, SectionTitle } from "@/components/page-header";
import { GoalTimetable } from "@/components/goal-timetable";
import { formatCurrency } from "@/lib/format";
import { DashboardCalendar } from "@/components/dashboard-calendar";
import { AddTradeButton } from "@/components/add-trade-button";

const MONTH_LABELS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const mainAccount = await prisma.account.findFirst({
    where: { userId: user.id, isMain: true },
  });

  if (!mainAccount) {
    return (
      <div className="px-4 py-5 md:px-8 md:py-7 space-y-8">
        <PageHeader page="dashboard" title="Dashboard" />
        <div className="board px-5 py-6 max-w-xl space-y-2">
          <p className="font-heading text-[15px] font-semibold uppercase tracking-[0.1em] text-flap-yellow">No main account</p>
          <p className="text-[14px] text-flap-dim">
            The board reads one account. Mark an account as main and its open positions, P&amp;L, and goal will post here.
          </p>
          <Link href="/accounts" className="inline-block pt-1 text-[14px] font-semibold text-flap-ink underline hover:text-flap-yellow">
            Choose a main account
          </Link>
        </div>
      </div>
    );
  }

  const today = new Date();
  const currentYear = today.getUTCFullYear();
  const currentMonth = today.getUTCMonth(); // 0-indexed, UTC

  // Fetch closed trades for current year on main account
  const closedTrades = await prisma.trade.findMany({
    where: {
      userId: user.id,
      accountId: mainAccount.id,
      closeDate: { not: null },
    },
    select: { id: true, netPnl: true, closeDate: true },
  });

  const ytdTrades = closedTrades.filter((t) => {
    if (!t.closeDate) return false;
    return new Date(t.closeDate).getUTCFullYear() === currentYear;
  });

  const currentMonthTrades = ytdTrades.filter((t) => {
    if (!t.closeDate) return false;
    return new Date(t.closeDate).getUTCMonth() === currentMonth;
  });

  // Open trades — all for display + risk
  const [rawOpenTrades, accounts, setups, goal, cashActivities] = await Promise.all([
    prisma.trade.findMany({
      where: { userId: user.id, accountId: mainAccount.id, closeDate: null },
      select: {
        id: true,
        name: true,
        ticker: true,
        symbol: true,
        side: true,
        entryPrice: true,
        quantity: true,
        contractSize: true,
        optionType: true,
        strike: true,
        expiration: true,
        projectedProfit: true,
        openDate: true,
        accountId: true,
        notes: true,
        tradeSetups: { select: { setupId: true } },
      },
      orderBy: { openDate: "asc" },
    }),
    prisma.account
      .findMany({
        where: { userId: user.id },
        select: { id: true, name: true, optionAssignmentFee: true },
      })
      .then((accs) =>
        accs.map((a) => ({
          ...a,
          optionAssignmentFee: Number(a.optionAssignmentFee),
        })),
      ),
    prisma.setup.findMany({
      where: { userId: user.id },
      select: { id: true, name: true },
    }),
    prisma.goal.findFirst({
      where: { userId: user.id, accountId: mainAccount.id, year: currentYear },
    }),
    prisma.cashActivity.findMany({
      where: {
        userId: user.id,
        accountId: mainAccount.id,
        type: { not: 'DEPOSIT' },
        date: {
          gte: new Date(`${currentYear}-01-01`),
          lt: new Date(`${currentYear + 1}-01-01`),
        },
      },
      select: { date: true, amount: true },
    }),
  ]);

  const openPositions: DashboardPosition[] = rawOpenTrades.map((t) => ({
    id: t.id,
    name: t.name,
    ticker: t.ticker,
    symbol: t.symbol,
    side: t.side as "LONG" | "SHORT",
    entryPrice: Number(t.entryPrice),
    quantity: Number(t.quantity),
    contractSize: t.contractSize,
    optionType: t.optionType as "CALL" | "PUT" | null,
    strike: t.strike ? Number(t.strike) : null,
    expiration: t.expiration?.toISOString() ?? null,
    projectedProfit: t.projectedProfit ? Number(t.projectedProfit) : null,
    openDate: t.openDate.toISOString(),
    accountId: t.accountId,
    notes: t.notes ?? null,
    tradeSetups: t.tradeSetups,
  }));

  // Cash activity totals — distributed by month
  const cashYtdPnl = cashActivities.reduce((s, ca) => s + Number(ca.amount), 0);
  const cashMonthPnl = cashActivities
    .filter((ca) => new Date(ca.date).getUTCMonth() === currentMonth)
    .reduce((s, ca) => s + Number(ca.amount), 0);

  // KPI calculations
  const monthlyPnl = currentMonthTrades.reduce(
    (s, t) => s + Number(t.netPnl ?? 0),
    0,
  ) + cashMonthPnl;
  const ytdPnl = ytdTrades.reduce((s, t) => s + Number(t.netPnl ?? 0), 0) + cashYtdPnl;
  const winningTrades = ytdTrades.filter(
    (t) => Number(t.netPnl ?? 0) > 0,
  ).length;
  const winRate =
    ytdTrades.length > 0 ? (winningTrades / ytdTrades.length) * 100 : 0;
  const openRisk = calcOpenRisk(
    openPositions.map((t) => ({
      side: t.side,
      optionType: t.optionType,
      entryPrice: t.entryPrice,
      quantity: t.quantity,
      contractSize: t.contractSize,
      strike: t.strike,
    })),
  );
  const startingBalance = Number(mainAccount.startingBalance);
  const pctReturn = startingBalance > 0 ? (ytdPnl / startingBalance) * 100 : 0;

  // Equity chart data — monthly (trades + cash activities)
  const actualMonthlyPnl = Array(12).fill(0);
  for (const trade of ytdTrades) {
    if (!trade.closeDate) continue;
    actualMonthlyPnl[new Date(trade.closeDate).getUTCMonth()] += Number(
      trade.netPnl ?? 0,
    );
  }
  for (const ca of cashActivities) {
    actualMonthlyPnl[new Date(ca.date).getUTCMonth()] += Number(ca.amount);
  }

  let cumActual = startingBalance;
  let cumExpected = startingBalance;

  const g = goal
    ? {
        goalAmount: Number(goal.goalAmount),
        curveFactor: Number(goal.curveFactor),
        monthlyFixedWd: Number(goal.monthlyFixedWd),
        monthlyVariableWdPct: Number(goal.monthlyVariableWdPct),
      }
    : null;

  const breakdown = g ? monthlyBreakdown(g) : null;

  const equityData: EquityDataPoint[] = [];
  for (let i = 0; i < 12; i++) {
    cumActual += actualMonthlyPnl[i];
    if (breakdown) cumExpected += breakdown[i].expectedPnl;
    equityData.push({
      month: MONTH_LABELS[i],
      // The equity line stops at the current month; the timetable runs on.
      actual: i <= currentMonth ? cumActual : null,
      expected: breakdown ? cumExpected : null,
    });
  }

  // Goal progress — yearly
  const goalExpectedYTD = g ? expectedCumPnL(g, today) : 0;
  const goalAmount = g?.goalAmount ?? 0;
  // Goal progress — current month
  const monthExpected = breakdown ? breakdown[currentMonth].expectedPnl : 0;
  // Money on the board carries cents, matching the tables and calendar.
  const signedMoney = (n: number) => `${n > 0 ? "+" : ""}${formatCurrency(n)}`;
  const projTotal = openPositions.reduce((s, t) => s + (t.projectedProfit ?? 0), 0);

  const totals: BoardTotal[] = [
    {
      label: `${MONTH_LABELS[currentMonth]} P&L`,
      value: signedMoney(monthlyPnl),
      tone: monthlyPnl > 0 ? "gain" : monthlyPnl < 0 ? "loss" : "dim",
    },
    {
      label: "YTD return",
      value: `${pctReturn > 0 ? "+" : ""}${pctReturn.toFixed(2)}%`,
      tone: pctReturn > 0 ? "gain" : pctReturn < 0 ? "loss" : "dim",
    },
    {
      label: `Win rate · ${winningTrades}/${ytdTrades.length}`,
      value: `${winRate.toFixed(1)}%`,
    },
    { label: "Open risk", value: formatCurrency(openRisk), tone: "yellow" },
    {
      label: "Projected premium",
      value: signedMoney(projTotal),
      tone: projTotal > 0 ? "gain" : projTotal < 0 ? "loss" : "dim",
    },
  ];

  return (
    <div className="px-4 py-5 md:px-8 md:py-7 space-y-8">
      <PageHeader
        page="dashboard"
        title="Dashboard"
        meta={<>{mainAccount.name} · {MONTH_LABELS[currentMonth]} {currentYear}</>}
        actions={<AddTradeButton accounts={accounts} setups={setups} />}
      />

      <DashboardOpenPositions
        positions={openPositions}
        totals={totals}
        accounts={accounts}
        setups={setups}
      />

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] gap-x-10 gap-y-8">
        <section className="space-y-4 min-w-0">
          <SectionTitle aside={`Starting balance ${formatCurrency(startingBalance)}`}>
            Equity {currentYear}
          </SectionTitle>
          <EquityChart data={equityData} />
        </section>

        <section aria-label="Goal" className="min-w-0 xl:border-l xl:pl-10">
          {goal && breakdown ? (
            <GoalTimetable
              year={currentYear}
              monthIndex={currentMonth}
              monthLabel={MONTH_LABELS[currentMonth]}
              monthActual={monthlyPnl}
              monthExpected={monthExpected}
              ytdActual={ytdPnl}
              ytdExpected={goalExpectedYTD}
              goalAmount={goalAmount}
              curveFactor={g?.curveFactor ?? 1}
            />
          ) : (
            <div className="rounded-lg border border-dashed p-5 space-y-2">
              <h2 className="text-[17px] font-semibold">No timetable for {currentYear}</h2>
              <p className="text-[13px] text-muted-foreground">
                Set a yearly income goal and the dashboard will show whether the book runs ahead of or behind it, month by month.
              </p>
              <Link href="/goals" className="inline-block text-[13px] font-semibold text-primary hover:underline">
                Create a {currentYear} goal
              </Link>
            </div>
          )}
        </section>
      </div>

      <section>
        <DashboardCalendar
          trades={closedTrades.map((t) => ({
            id: t.id,
            closeDate: t.closeDate,
            netPnl: t.netPnl ? Number(t.netPnl) : null,
          }))}
          initialMonth={currentMonth + 1}
          initialYear={currentYear}
        />
      </section>
    </div>
  );
}
