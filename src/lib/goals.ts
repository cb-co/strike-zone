export type GoalParams = {
  goalAmount: number
  curveFactor: number
  monthlyFixedWd: number
  monthlyVariableWdPct: number
}

/** Beginning-of-month progress ratio for month m (1–12) */
export function bom(m: number, cf: number): number {
  return Math.pow(Math.max(0, Math.min(1, (m - 1) / 12)), cf)
}

/** End-of-month progress ratio for month m (1–12) */
export function eom(m: number, cf: number): number {
  return Math.pow(Math.min(1, m / 12), cf)
}

/** Expected P&L for month m given goal */
export function monthlyExpected(m: number, g: GoalParams): number {
  return g.goalAmount * (eom(m, g.curveFactor) - bom(m, g.curveFactor))
}

/** Expected variable withdrawal for month m */
export function monthlyVarWd(m: number, g: GoalParams): number {
  return monthlyExpected(m, g) * g.monthlyVariableWdPct
}

/** Expected total needed for month m (P&L + fixed WD + variable WD) */
export function monthlyTotal(m: number, g: GoalParams): number {
  return monthlyExpected(m, g) + g.monthlyFixedWd + monthlyVarWd(m, g)
}

/** Day of year (1–365) */
export function dayOfYear(date: Date): number {
  const start = new Date(Date.UTC(date.getUTCFullYear(), 0, 1))
  const diff = date.getTime() - start.getTime()
  return Math.floor(diff / 86_400_000) + 1
}

/** Expected cumulative P&L as of a given date */
export function expectedCumPnL(g: GoalParams, date: Date): number {
  const pct = Math.pow(dayOfYear(date) / 365, g.curveFactor)
  return g.goalAmount * pct
}

export type MonthBreakdown = {
  month: number
  expectedPnl: number
  expectedVarWd: number
  expectedTotal: number
}

/** Full 12-month breakdown for a goal */
export function monthlyBreakdown(g: GoalParams): MonthBreakdown[] {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1
    return {
      month: m,
      expectedPnl: monthlyExpected(m, g),
      expectedVarWd: monthlyVarWd(m, g),
      expectedTotal: monthlyTotal(m, g),
    }
  })
}
