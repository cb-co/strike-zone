export type TradeForPnl = {
  side: 'LONG' | 'SHORT'
  entryPrice: number
  exitPrice: number
  quantity: number
  contractSize?: number | null
}

export function calcNetPnl(t: TradeForPnl): number {
  const mult = t.contractSize ?? 1
  const diff = t.side === 'LONG'
    ? t.exitPrice - t.entryPrice
    : t.entryPrice - t.exitPrice
  return diff * t.quantity * mult
}

export type OpenTrade = {
  side: 'LONG' | 'SHORT'
  optionType?: 'CALL' | 'PUT' | null
  entryPrice: number
  quantity: number
  contractSize?: number | null
  strike?: number | null
}

export function calcOpenRisk(trades: OpenTrade[]): number {
  return trades.reduce((sum, t) => {
    const mult = t.contractSize ?? 1
    if (t.side === 'SHORT') {
      if (t.optionType === 'PUT' && t.strike != null) {
        // Short put: max risk = (strike − premium per share) × qty × mult
        return sum + (t.strike - t.entryPrice) * t.quantity * mult
      }
      // Short call or naked short: indeterminate, exclude
      return sum
    }
    // Long stock or long option: max loss = cost paid
    return sum + t.entryPrice * t.quantity * mult
  }, 0)
}
