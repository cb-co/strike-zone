import { describe, it, expect } from 'vitest'
import { calcNetPnl, calcOpenRisk } from './trades'

describe('calcNetPnl', () => {
  it('LONG profit: exit > entry', () => {
    expect(calcNetPnl({ side: 'LONG', entryPrice: 10, exitPrice: 12, quantity: 5, contractSize: 1 })).toBe(10)
  })
  it('LONG loss: exit < entry', () => {
    expect(calcNetPnl({ side: 'LONG', entryPrice: 12, exitPrice: 10, quantity: 5, contractSize: 1 })).toBe(-10)
  })
  it('SHORT profit: entry > exit', () => {
    expect(calcNetPnl({ side: 'SHORT', entryPrice: 12, exitPrice: 10, quantity: 5, contractSize: 1 })).toBe(10)
  })
  it('SHORT loss: exit > entry', () => {
    expect(calcNetPnl({ side: 'SHORT', entryPrice: 10, exitPrice: 12, quantity: 5, contractSize: 1 })).toBe(-10)
  })
  it('option multiplier: contractSize=100', () => {
    expect(calcNetPnl({ side: 'LONG', entryPrice: 1, exitPrice: 2, quantity: 1, contractSize: 100 })).toBe(100)
  })
  it('null contractSize defaults to 1', () => {
    expect(calcNetPnl({ side: 'LONG', entryPrice: 1, exitPrice: 2, quantity: 3, contractSize: null })).toBe(3)
  })
  it('undefined contractSize defaults to 1', () => {
    expect(calcNetPnl({ side: 'LONG', entryPrice: 1, exitPrice: 2, quantity: 3 })).toBe(3)
  })
})

describe('calcOpenRisk', () => {
  it('single stock position', () => {
    expect(calcOpenRisk([{ side: 'LONG', entryPrice: 10, quantity: 5, contractSize: 1 }])).toBe(50)
  })
  it('sums multiple positions', () => {
    expect(calcOpenRisk([
      { side: 'LONG', entryPrice: 10, quantity: 2, contractSize: 1 },
      { side: 'LONG', entryPrice: 1.5, quantity: 1, contractSize: 100 },
    ])).toBe(170)
  })
  it('empty array returns 0', () => {
    expect(calcOpenRisk([])).toBe(0)
  })
  it('null contractSize treated as 1', () => {
    expect(calcOpenRisk([{ side: 'LONG', entryPrice: 5, quantity: 10, contractSize: null }])).toBe(50)
  })
})
