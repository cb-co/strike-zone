// src/lib/parse-cash-activity.ts

export type CashActivityType =
  | 'MARGIN_INTEREST'
  | 'INTEREST'
  | 'DIVIDEND'
  | 'TAX'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'OTHER'

export type CashActivityRecord = {
  date: string        // YYYY-MM-DD
  description: string // trimmed raw description
  type: CashActivityType
  amount: number      // negative = outflow
  currency: string
}

function classifyDescription(desc: string): CashActivityType {
  if (/%/.test(desc) && /\d{2}\/\d{2}-\d{2}\/\d{2}/.test(desc)) return 'MARGIN_INTEREST'
  if (/FPL Revenue|FPL INTEREST CR/i.test(desc)) return 'INTEREST'
  if (/NRA WITHHOLD: DIVIDEND/i.test(desc)) return 'TAX'
  if (/NRA WITHHOLDING/i.test(desc)) return 'TAX'
  if (/DEPOSIT/i.test(desc)) return 'DEPOSIT'
  if (/WITHDRAWAL|DISBURSEMENT/i.test(desc)) return 'WITHDRAWAL'
  if (/^[A-Z][A-Z\s]+\s+\d+\s*$/.test(desc)) return 'DIVIDEND'
  return 'OTHER'
}

function parseDate(raw: string): string {
  const [month, day, year] = raw.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[$,]/g, ''))
}

function parseCsvLine(line: string): string[] {
  // All fields in TradeStation cash activity CSVs are double-quoted
  return line.replace(/^"|"$/g, '').split('","')
}

export function parseCashActivityCsv(text: string): CashActivityRecord[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Find the data header row
  const headerIdx = lines.findIndex(l => l.includes('"Date"'))
  if (headerIdx === -1) return []

  const records: CashActivityRecord[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('"')) continue

    const fields = parseCsvLine(line)
    if (fields.length < 4) continue

    const [rawDate, rawDesc, rawAmount, rawCurrency] = fields
    const description = rawDesc.trim()

    records.push({
      date: parseDate(rawDate),
      description,
      type: classifyDescription(description),
      amount: parseAmount(rawAmount),
      currency: rawCurrency.trim(),
    })
  }

  return records
}
