export function formatCurrency(n: number, opts?: Intl.NumberFormatOptions): string {
  const abs = Math.abs(n)
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    ...opts,
  })
  return n < 0 ? `-$${formatted}` : `$${formatted}`
}
