export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim()
  if (!q || q.length < 1) return Response.json({ results: [] })

  const url =
    `https://query1.finance.yahoo.com/v1/finance/search` +
    `?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0` +
    `&enableFuzzyQuery=false&enableEnhancedTrivialQuery=true`

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 },
    })
    if (!res.ok) return Response.json({ results: [] })
    const data = await res.json()

    const ALLOWED = new Set(['EQUITY', 'ETF', 'INDEX', 'FUTURE'])
    const results = (data.quotes ?? [])
      .filter((q: Record<string, string>) => ALLOWED.has(q.quoteType))
      .map((q: Record<string, string>) => ({
        symbol: q.symbol,
        name: q.shortname ?? q.longname ?? q.symbol,
        exchange: q.exchDisp ?? '',
        type: q.quoteType,
      }))

    return Response.json({ results })
  } catch {
    return Response.json({ results: [] })
  }
}
