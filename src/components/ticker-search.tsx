'use client'

import { useState, useEffect, useRef } from 'react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

type Result = { symbol: string; name: string; exchange: string; type: string }

type Props = {
  /** Name of the hidden input submitted with the form */
  name?: string
  /** Pre-fill the ticker (e.g. when editing) */
  defaultTicker?: string
  /** Controlled value — syncs query/committed when changed externally */
  value?: string
  placeholder?: string
  onSelect?: (ticker: string, name: string) => void
  className?: string
}

export function TickerSearch({ name, defaultTicker = '', value, placeholder = 'Search ticker…', onSelect, className }: Props) {
  const [query, setQuery] = useState(value ?? defaultTicker)
  // `committed` is what goes into the hidden input — starts as the default, updated on dropdown selection
  const [committed, setCommitted] = useState(value ?? defaultTicker)

  // Sync when parent sets value externally (e.g. auto-filled from symbol parse)
  useEffect(() => {
    if (value !== undefined && value !== committed) {
      setQuery(value)
      setCommitted(value)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  const [results, setResults] = useState<Result[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = query.trim()
    // Don't search when query matches the committed selection (no change)
    if (!q || q === committed) {
      setResults([])
      setOpen(false)
      return
    }

    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/ticker-search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        setResults(data.results ?? [])
        setActiveIdx(-1)
        setOpen((data.results ?? []).length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)

    return () => { if (timerRef.current) clearTimeout(timerRef.current) }
  }, [query, committed])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // Revert display to last committed ticker if user typed without selecting
        setQuery(committed)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [committed])

  function pick(r: Result) {
    setCommitted(r.symbol)
    setQuery(r.symbol)
    setOpen(false)
    setResults([])
    onSelect?.(r.symbol, r.name)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)) }
    if (e.key === 'Enter' && activeIdx >= 0) { e.preventDefault(); pick(results[activeIdx]) }
    if (e.key === 'Escape') { setOpen(false); setQuery(committed) }
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {name && <input type="hidden" name={name} value={committed} />}
      <div className="relative">
        <Input
          placeholder={placeholder}
          value={query}
          onChange={(e) => { setQuery(e.target.value.toUpperCase()) }}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          className="font-mono pr-7"
          autoComplete="off"
        />
        {loading && (
          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground animate-pulse">…</span>
        )}
      </div>
      {open && results.length > 0 && (
        <div className="absolute z-50 w-full mt-1 rounded-md border bg-popover shadow-md overflow-hidden max-h-60 overflow-y-auto">
          {results.map((r, i) => (
            <button
              key={r.symbol}
              type="button"
              className={cn(
                'w-full px-3 py-2 text-left text-sm flex items-center justify-between gap-2',
                i === activeIdx ? 'bg-accent' : 'hover:bg-muted',
              )}
              onMouseEnter={() => setActiveIdx(i)}
              onClick={() => pick(r)}
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="font-mono font-medium shrink-0">{r.symbol}</span>
                <span className="text-muted-foreground text-xs truncate">{r.name}</span>
              </div>
              <span className="text-xs text-muted-foreground shrink-0">{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
