'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'

const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$+-.,%'
const TICK_MS = 55

type Tone = 'ink' | 'dim' | 'yellow' | 'gain' | 'loss'
type Size = 'sm' | 'md' | 'lg'

const TONE: Record<Tone, string> = {
  ink: 'text-flap-ink',
  dim: 'text-flap-dim',
  yellow: 'text-flap-yellow',
  gain: 'text-flap-gain',
  loss: 'text-flap-loss',
}

const SIZE: Record<Size, string> = {
  sm: 'text-[14px] [--cw:0.88em] [--ch:1.5em] gap-px',
  md: 'text-[15px] sm:text-[19px] [--cw:0.82em] [--ch:1.45em] gap-px sm:gap-[2px]',
  lg: 'text-[22px] sm:text-[30px] [--cw:0.78em] [--ch:1.38em] gap-[2px]',
}

function pad(value: string, cells: number | undefined, align: 'left' | 'right') {
  const v = value.toUpperCase()
  if (!cells || v.length >= cells) return v
  return align === 'right' ? v.padStart(cells, ' ') : v.padEnd(cells, ' ')
}

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * A row of split-flap cells. The settled value renders on the server. When a
 * value changes, its leaves riffle for about a quarter second and land on the
 * new value, the way a Solari board announces fresh information. A flap with an
 * `id` also riffles once per browser session the first time it posts, and stays
 * still on later visits while its value is unchanged.
 */
export function Flap({
  value,
  id,
  cells,
  align = 'left',
  tone = 'ink',
  size = 'sm',
  delay = 0,
  className,
}: {
  value: string
  /** Stable key; lets the first posting of this value riffle once per session. */
  id?: string
  cells?: number
  align?: 'left' | 'right'
  tone?: Tone
  size?: Size
  /** Stagger offset in ms so a board riffles row by row. */
  delay?: number
  className?: string
}) {
  const target = pad(value, cells, align)
  // null means settled: render the target directly.
  const [anim, setAnim] = useState<string | null>(null)
  const [flipping, setFlipping] = useState<Set<number>>(new Set())
  const shown = anim ?? target
  const frame = useRef<ReturnType<typeof setInterval> | null>(null)
  const previous = useRef<string | null>(null)

  useEffect(() => {
    const firstRun = previous.current === null
    previous.current = target
    if (prefersReducedMotion()) return
    if (firstRun) {
      // Only announce a first posting that this session has not seen yet.
      if (!id) return
      try {
        const key = `flap:${id}`
        if (sessionStorage.getItem(key) === target) return
        sessionStorage.setItem(key, target)
      } catch {
        return
      }
    }
    const chars = [...target]
    // Every leaf spins three to five times, so a whole value lands inside ~300ms.
    const settleAt = chars.map((c) => (c === ' ' ? 0 : 3 + Math.floor(Math.random() * 3)))
    let tick = 0
    const start = setTimeout(() => {
      frame.current = setInterval(() => {
        tick++
        const moving = new Set<number>()
        const next = chars
          .map((c, i) => {
            if (tick >= settleAt[i]) return c
            moving.add(i)
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)]
          })
          .join('')
        setFlipping(moving)
        if (moving.size === 0) {
          setAnim(null)
          if (frame.current) clearInterval(frame.current)
          frame.current = null
        } else {
          setAnim(next)
        }
      }, TICK_MS)
    }, delay)
    return () => {
      clearTimeout(start)
      if (frame.current) clearInterval(frame.current)
      frame.current = null
    }
  }, [target, delay, id])

  return (
    <span
      role="img"
      aria-label={value}
      className={cn('inline-flex shrink-0 align-middle', SIZE[size], TONE[tone], className)}
    >
      {[...shown].map((ch, i) => (
        <span
          key={i}
          aria-hidden
          data-flipping={flipping.has(i) ? '' : undefined}
          className="flap-cell w-(--cw) h-(--ch)"
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}

/** A single wide status leaf, like the coloured remark flaps on a departure board. */
export function FlapStatus({
  label,
  kind,
  className,
}: {
  label: string
  kind: 'ontime' | 'due' | 'late' | 'hold'
  className?: string
}) {
  return (
    <span
      className={cn(
        'flap-cell h-[1.55em] px-2 text-[13.5px] tracking-[0.06em] min-w-[5.2rem] after:bg-black/20',
        kind === 'ontime' && 'text-flap-ink',
        kind === 'hold' && 'text-flap-ink',
        kind === 'due' && '[background:var(--flap-yellow)] text-signal-foreground',
        kind === 'late' && '[background:var(--flap-loss)] text-signal-foreground',
        className,
      )}
    >
      {label}
    </span>
  )
}
