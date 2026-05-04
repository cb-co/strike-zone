import { prisma } from '@/lib/prisma'

const TS_BASE = 'https://api.tradestation.com'
const TS_TOKEN_URL = 'https://signin.tradestation.com/oauth/token'

export async function refreshAccessToken(userId: string): Promise<string> {
  const token = await prisma.tradestationToken.findUnique({ where: { userId } })
  if (!token) throw new Error('No TradeStation token found')

  const res = await fetch(TS_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: process.env.TRADESTATION_CLIENT_ID!,
      client_secret: process.env.TRADESTATION_CLIENT_SECRET!,
      refresh_token: token.refreshToken,
    }),
  })

  if (!res.ok) throw new Error(`Token refresh failed: ${res.status}`)
  const data = await res.json() as { access_token: string; refresh_token: string; expires_in: number }

  await prisma.tradestationToken.update({
    where: { userId },
    data: {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: new Date(Date.now() + data.expires_in * 1000),
    },
  })

  return data.access_token
}

export async function getValidToken(userId: string): Promise<string> {
  const token = await prisma.tradestationToken.findUnique({ where: { userId } })
  if (!token) throw new Error('TradeStation not connected')

  if (token.expiresAt.getTime() < Date.now() + 60_000) {
    return refreshAccessToken(userId)
  }
  return token.accessToken
}

export type TSOrder = {
  OrderID: string
  Symbol: string
  Quantity: string
  FilledPrice: string
  AveragePrice: string
  OpenedDateTime: string
  ClosedDateTime?: string
  BuyOrSell: 'Buy' | 'Sell'
  AssetType: string
  ContractExpireDate?: string
  StrikePrice?: string
  OptionType?: 'Call' | 'Put'
}

export async function fetchOrders(accessToken: string, accountKey: string): Promise<TSOrder[]> {
  const res = await fetch(`${TS_BASE}/v3/brokerage/accounts/${accountKey}/orders?pageSize=600`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) throw new Error(`TS orders fetch failed: ${res.status}`)
  const data = await res.json() as { Orders?: TSOrder[] }
  return data.Orders ?? []
}

export function mapOrderToTrade(order: TSOrder, userId: string, accountId: string) {
  const isOption = order.AssetType === 'OP'
  const side: 'LONG' | 'SHORT' = order.BuyOrSell === 'Buy' ? 'LONG' : 'SHORT'
  const openDate = new Date(order.OpenedDateTime)

  return {
    userId,
    accountId,
    name: `${order.Symbol} (TS)`,
    ticker: isOption ? order.Symbol.slice(0, 4).toUpperCase() : order.Symbol.toUpperCase(),
    symbol: order.Symbol.toUpperCase(),
    side,
    quantity: parseFloat(order.Quantity),
    entryPrice: parseFloat(order.AveragePrice || order.FilledPrice),
    openDate,
    source: 'TS_IMPORT' as const,
    optionType: isOption ? (order.OptionType === 'Call' ? 'CALL' as const : 'PUT' as const) : null,
    strike: order.StrikePrice ? parseFloat(order.StrikePrice) : null,
    expiration: order.ContractExpireDate ? new Date(order.ContractExpireDate) : null,
    contractSize: isOption ? 100 : null,
  }
}
