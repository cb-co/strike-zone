import { describe, it, expect } from 'vitest'
import {
  bom, eom, monthlyExpected, monthlyVarWd, monthlyTotal,
  dayOfYear, expectedCumPnL, monthlyBreakdown
} from './goals'

const LINEAR: import('./goals').GoalParams = {
  goalAmount: 12000,
  curveFactor: 1,
  monthlyFixedWd: 0,
  monthlyVariableWdPct: 0,
}

describe('bom', () => {
  it('month 1 starts at 0', () => expect(bom(1, 1)).toBe(0))
  it('month 13 would clamp to 1', () => expect(bom(13, 1)).toBe(1))
  it('is fractional for mid-year', () => {
    const v = bom(7, 1)
    expect(v).toBeGreaterThan(0)
    expect(v).toBeLessThan(1)
  })
})

describe('eom', () => {
  it('month 12 is 1', () => expect(eom(12, 1)).toBe(1))
  it('month 6 is ~0.5 for linear', () => expect(eom(6, 1)).toBeCloseTo(0.5))
})

describe('monthlyBreakdown (linear curve)', () => {
  const breakdown = monthlyBreakdown(LINEAR)

  it('returns 12 months', () => expect(breakdown).toHaveLength(12))

  it('each month gets ~1000 (1/12 of 12000)', () => {
    breakdown.forEach((b) => {
      expect(b.expectedPnl).toBeCloseTo(1000, 0)
    })
  })

  it('sum of all months equals goalAmount', () => {
    const total = breakdown.reduce((sum, b) => sum + b.expectedPnl, 0)
    expect(total).toBeCloseTo(LINEAR.goalAmount, 1)
  })

  it('no withdrawals when wd params are 0', () => {
    breakdown.forEach((b) => {
      expect(b.expectedVarWd).toBe(0)
      expect(b.expectedTotal).toBeCloseTo(b.expectedPnl, 5)
    })
  })
})

describe('monthlyVarWd', () => {
  it('is a percentage of expected', () => {
    const g = { ...LINEAR, monthlyVariableWdPct: 0.1 }
    const exp = monthlyExpected(6, g)
    expect(monthlyVarWd(6, g)).toBeCloseTo(exp * 0.1, 5)
  })
})

describe('monthlyTotal', () => {
  it('includes fixed and variable WD', () => {
    const g = { ...LINEAR, monthlyFixedWd: 500, monthlyVariableWdPct: 0.1 }
    const exp = monthlyExpected(6, g)
    const varWd = exp * 0.1
    expect(monthlyTotal(6, g)).toBeCloseTo(exp + 500 + varWd, 5)
  })
})

describe('dayOfYear', () => {
  it('Jan 1 is day 1', () => expect(dayOfYear(new Date('2026-01-01'))).toBe(1))
  it('Dec 31 is 365', () => expect(dayOfYear(new Date('2026-12-31'))).toBe(365))
})

describe('expectedCumPnL', () => {
  it('mid-year for linear goal is ~half the goal', () => {
    const midYear = new Date('2026-07-02') // roughly day 183
    const result = expectedCumPnL(LINEAR, midYear)
    expect(result).toBeGreaterThan(5000)
    expect(result).toBeLessThan(7000)
  })
  it('full year approaches goalAmount', () => {
    const endOfYear = new Date('2026-12-31')
    const result = expectedCumPnL(LINEAR, endOfYear)
    expect(result).toBeCloseTo(LINEAR.goalAmount, 0)
  })
})
