// Pure client-safe QFX/OFX parser. No imports.

export type QfxOptionTx = {
  fitId: string
  tradeDate: string          // YYYY-MM-DD
  symbol: string             // abbreviated OCC: SOXL260508P120
  ticker: string             // underlying: SOXL
  optionType: 'CALL' | 'PUT'
  strike: number
  expiration: string         // YYYY-MM-DD
  contracts: number          // always positive
  unitPrice: number          // per-share price
  commission: number
  netTotal: number           // signed: positive=credit received, negative=debit paid
  action: 'SELLTOOPEN' | 'SELLTOCLOSE' | 'BUYTOOPEN' | 'BUYTOCLOSE'
  contractSize: number
}

export type MergedTx = Omit<QfxOptionTx, 'fitId'> & { fitIds: string[] }

export type QfxParseResult = {
  brokerAccountId: string
  dateRange: { start: string; end: string }
  transactions: QfxOptionTx[]
  errors: string[]
}

type SecInfo = {
  ticker: string
  optionType: 'CALL' | 'PUT'
  strike: number
  expiration: string
  contractSize: number
}

// Helper: extract value of first matching tag in text block
// Returns content between <TAG> and next <, trimmed
function extractField(text: string, tag: string): string {
  const open = `<${tag}>`
  const start = text.indexOf(open)
  if (start === -1) return ''
  const valueStart = start + open.length
  const end = text.indexOf('<', valueStart)
  if (end === -1) return text.slice(valueStart).trim()
  return text.slice(valueStart, end).trim()
}

// Helper: extract all blocks matching <TAG>...</TAG>
function extractBlocks(text: string, tag: string): string[] {
  const open = `<${tag}>`
  const close = `</${tag}>`
  const blocks: string[] = []
  let pos = 0
  while (pos < text.length) {
    const start = text.indexOf(open, pos)
    if (start === -1) break
    const end = text.indexOf(close, start + open.length)
    if (end === -1) break
    blocks.push(text.slice(start + open.length, end))
    pos = end + close.length
  }
  return blocks
}

// Helper: parse OFX date string "20260501120000" → "2026-05-01"
// Also strips timezone suffix like [-5:EST]
function parseOFXDate(d: string): string {
  const cleaned = d.split('[')[0].trim()
  const year = cleaned.slice(0, 4)
  const month = cleaned.slice(4, 6)
  const day = cleaned.slice(6, 8)
  return `${year}-${month}-${day}`
}

// Helper: extract underlying ticker from abbreviated OCC symbol
// "SOXL260508P120" → "SOXL"
function underlyingTicker(occSymbol: string): string {
  // OCC symbol: up to 6 chars ticker, 6-digit date, C or P, strike
  const match = occSymbol.match(/^([A-Z]+)\d{6}[CP]/)
  if (match) return match[1]
  return occSymbol
}

function buildSecMap(content: string): Map<string, SecInfo> {
  const map = new Map<string, SecInfo>()
  const optInfoBlocks = extractBlocks(content, 'OPTINFO')
  for (const block of optInfoBlocks) {
    const secInfo = extractBlocks(block, 'SECINFO')[0] ?? block
    const uniqueId = extractField(secInfo, 'UNIQUEID')
    if (!uniqueId) continue

    const ticker = extractField(secInfo, 'TICKER')
    if (!ticker) continue

    const optType = extractField(block, 'OPTTYPE').toUpperCase()
    const optionType: 'CALL' | 'PUT' = optType === 'PUT' ? 'PUT' : 'CALL'

    let strike = parseFloat(extractField(block, 'STRIKEPRICE') || '0')
    if (!strike || strike === 0) {
      // TradeStation bug: fall back to parsing strike from the ticker
      const strikeMatch = ticker.match(/[CP](\d+(?:\.\d+)?)$/)
      if (strikeMatch) strike = parseFloat(strikeMatch[1])
    }

    const dtExpire = extractField(block, 'DTEXPIRE')
    const expiration = dtExpire ? parseOFXDate(dtExpire) : ''

    const shPerCtrct = extractField(block, 'SHPERCTRCT')
    const contractSize = shPerCtrct ? parseFloat(shPerCtrct) : 100

    map.set(uniqueId, { ticker, optionType, strike, expiration, contractSize })
  }
  return map
}

function parseOptBlock(
  block: string,
  secMap: Map<string, SecInfo>,
  actionField: 'OPTSELLTYPE' | 'OPTBUYTYPE',
  errors: string[]
): QfxOptionTx | null {
  const invTranBlock = extractBlocks(block, 'INVTRAN')[0] ?? block
  const fitId = extractField(invTranBlock, 'FITID')
  const dtTrade = extractField(invTranBlock, 'DTTRADE')
  const tradeDate = dtTrade ? parseOFXDate(dtTrade) : ''

  const secIdBlock = extractBlocks(block, 'SECID')[0] ?? block
  const uniqueId = extractField(secIdBlock, 'UNIQUEID')

  const units = parseFloat(extractField(block, 'UNITS') || '0')
  const unitPrice = parseFloat(extractField(block, 'UNITPRICE') || '0')
  const commission = parseFloat(extractField(block, 'COMMISSION') || '0')
  const total = parseFloat(extractField(block, 'TOTAL') || '0')
  const actionRaw = extractField(block, actionField).toUpperCase()

  const shPerCtrct = extractField(block, 'SHPERCTRCT')

  if (!uniqueId) return null

  const secInfo = secMap.get(uniqueId)
  if (!secInfo) {
    // Silently skip — stock transactions may appear
    return null
  }

  const contracts = Math.abs(units)
  const contractSize = shPerCtrct ? parseFloat(shPerCtrct) : secInfo.contractSize

  const action = actionRaw as QfxOptionTx['action']

  return {
    fitId,
    tradeDate,
    symbol: secInfo.ticker,
    ticker: underlyingTicker(secInfo.ticker),
    optionType: secInfo.optionType,
    strike: secInfo.strike,
    expiration: secInfo.expiration,
    contracts,
    unitPrice,
    commission,
    netTotal: total,
    action,
    contractSize,
  }
}

export function parseQfx(content: string): QfxParseResult {
  const errors: string[] = []

  const brokerAccountId = extractField(content, 'ACCTID')

  const dtStart = extractField(content, 'DTSTART')
  const dtEnd = extractField(content, 'DTEND')
  const dateRange = {
    start: dtStart ? parseOFXDate(dtStart) : '',
    end: dtEnd ? parseOFXDate(dtEnd) : '',
  }

  const secMap = buildSecMap(content)

  const transactions: QfxOptionTx[] = []

  const sellBlocks = extractBlocks(content, 'SELLOPT')
  for (const block of sellBlocks) {
    const tx = parseOptBlock(block, secMap, 'OPTSELLTYPE', errors)
    if (tx) transactions.push(tx)
  }

  const buyBlocks = extractBlocks(content, 'BUYOPT')
  for (const block of buyBlocks) {
    const tx = parseOptBlock(block, secMap, 'OPTBUYTYPE', errors)
    if (tx) transactions.push(tx)
  }

  transactions.sort((a, b) => {
    if (a.tradeDate < b.tradeDate) return -1
    if (a.tradeDate > b.tradeDate) return 1
    if (a.fitId < b.fitId) return -1
    if (a.fitId > b.fitId) return 1
    return 0
  })

  return { brokerAccountId, dateRange, transactions, errors }
}

export function mergeSplitFills(transactions: QfxOptionTx[]): MergedTx[] {
  const groups = new Map<string, QfxOptionTx[]>()

  for (const tx of transactions) {
    const key = `${tx.symbol}|${tx.tradeDate}|${tx.action}`
    const group = groups.get(key)
    if (group) {
      group.push(tx)
    } else {
      groups.set(key, [tx])
    }
  }

  const merged: MergedTx[] = []

  for (const group of groups.values()) {
    if (group.length === 1) {
      const { fitId, ...rest } = group[0]
      merged.push({ ...rest, fitIds: [fitId] })
      continue
    }

    const totalContracts = group.reduce((sum, tx) => sum + tx.contracts, 0)
    const weightedPrice = group.reduce((sum, tx) => sum + tx.unitPrice * tx.contracts, 0) / totalContracts
    const totalCommission = group.reduce((sum, tx) => sum + tx.commission, 0)
    const totalNetTotal = group.reduce((sum, tx) => sum + tx.netTotal, 0)
    const fitIds = group.map(tx => tx.fitId)

    const { fitId: _fitId, ...base } = group[0]
    merged.push({
      ...base,
      contracts: totalContracts,
      unitPrice: weightedPrice,
      commission: totalCommission,
      netTotal: totalNetTotal,
      fitIds,
    })
  }

  merged.sort((a, b) => {
    if (a.tradeDate < b.tradeDate) return -1
    if (a.tradeDate > b.tradeDate) return 1
    return 0
  })

  return merged
}
