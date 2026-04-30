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
  entryPrice: number
  quantity: number
  contractSize?: number | null
}

export function calcOpenRisk(trades: OpenTrade[]): number {
  return trades.reduce(
    (sum, t) => sum + t.entryPrice * t.quantity * (t.contractSize ?? 1),
    0
  )
}
