'use client'

import { useEffect, useState } from 'react'
import { Flap } from '@/components/flap'

type Phase = 'pre' | 'open' | 'after' | 'closed'

const PHASE_LABEL: Record<Phase, string> = {
  pre: 'Pre-market',
  open: 'Market open',
  after: 'After hours',
  closed: 'Market closed',
}

// Regular US equity session in New York time. Exchange holidays are not modelled.
const PRE_START = 4 * 60
const OPEN = 9 * 60 + 30
const CLOSE = 16 * 60
const AFTER_END = 20 * 60

function nyParts(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(now)
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '0'
  const hour = Number(get('hour')) % 24
  return {
    weekday: get('weekday'),
    hour,
    minute: Number(get('minute')),
    second: Number(get('second')),
  }
}

function sessionOf(now: Date) {
  const { weekday, hour, minute, second } = nyParts(now)
  const mins = hour * 60 + minute
  const weekend = weekday === 'Sat' || weekday === 'Sun'
  let phase: Phase = 'closed'
  let untilMins: number | null = null
  let untilLabel = ''
  if (!weekend) {
    if (mins >= PRE_START && mins < OPEN) {
      phase = 'pre'
      untilMins = OPEN - mins
      untilLabel = 'opens'
    } else if (mins >= OPEN && mins < CLOSE) {
      phase = 'open'
      untilMins = CLOSE - mins
      untilLabel = 'closes'
    } else if (mins >= CLOSE && mins < AFTER_END) {
      phase = 'after'
    }
  }
  return { phase, untilMins, untilLabel, hour, minute, second }
}

function fmtDuration(mins: number) {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`
}

/** Swiss railway clock face: bar indices, black hands, the red disc second hand. */
function ClockFace({ hour, minute, second, className }: { hour: number; minute: number; second: number; className?: string }) {
  const minuteAngle = minute * 6 + second * 0.1
  const hourAngle = (hour % 12) * 30 + minute * 0.5
  const secondAngle = second * 6
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden>
      <circle cx="50" cy="50" r="48" fill="oklch(0.99 0.002 240)" stroke="oklch(0.2 0.02 262)" strokeWidth="3" />
      {Array.from({ length: 60 }).map((_, i) => (
        <rect
          key={i}
          x={i % 5 === 0 ? 48 : 49.2}
          y={6}
          width={i % 5 === 0 ? 4 : 1.6}
          height={i % 5 === 0 ? 11 : 4}
          fill="oklch(0.2 0.02 262)"
          transform={`rotate(${i * 6} 50 50)`}
        />
      ))}
      <rect x="46.5" y="22" width="7" height="36" rx="0.5" fill="oklch(0.2 0.02 262)" transform={`rotate(${hourAngle} 50 50)`} />
      <rect x="47.5" y="9" width="5" height="49" rx="0.5" fill="oklch(0.2 0.02 262)" transform={`rotate(${minuteAngle} 50 50)`} />
      <g transform={`rotate(${secondAngle} 50 50)`}>
        <rect x="49.2" y="18" width="1.6" height="46" fill="oklch(0.55 0.21 27)" />
        <circle cx="50" cy="19" r="6" fill="oklch(0.55 0.21 27)" />
      </g>
      <circle cx="50" cy="50" r="1.6" fill="oklch(0.55 0.21 27)" />
    </svg>
  )
}

function useNow() {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const tick = () => setNow(new Date())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, 1000)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [])
  return now
}

const PHASE_FLAP: Record<Phase, { text: string; tone: 'gain' | 'yellow' | 'ink' }> = {
  open: { text: 'Open', tone: 'gain' },
  pre: { text: 'Pre-mkt', tone: 'yellow' },
  after: { text: 'After hrs', tone: 'yellow' },
  closed: { text: 'Closed', tone: 'ink' },
}

/**
 * The platform sign's clock: a Swiss railway face beside a phase flap. The
 * session drives the sign: the flap flips and recolours as New York moves from
 * pre-market to the bell to after hours.
 */
export function SessionSign() {
  const now = useNow()
  const s = now ? sessionOf(now) : null
  const time = s ? `${String(s.hour).padStart(2, '0')}:${String(s.minute).padStart(2, '0')}` : ''
  const flap = s ? PHASE_FLAP[s.phase] : null
  return (
    <div
      className="board flex items-center gap-3 pl-2 pr-3.5 py-1.5"
      role="status"
      aria-label={s ? `${PHASE_LABEL[s.phase]}, ${time} New York time` : 'Market session'}
      data-phase={s?.phase}
    >
      <ClockFace hour={s?.hour ?? 10} minute={s?.minute ?? 10} second={s?.second ?? 0} className="size-10 shrink-0" />
      <div className="flex flex-col gap-1 min-w-0" aria-hidden>
        <Flap value={flap?.text ?? ''} tone={flap?.tone ?? 'ink'} />
        <span className="board-label tabular-nums whitespace-nowrap" suppressHydrationWarning>
          {s ? (
            <>
              {time} ET
              {s.untilMins !== null && <> · {s.untilLabel} in {fmtDuration(s.untilMins)}</>}
            </>
          ) : '\u00a0'}
        </span>
      </div>
    </div>
  )
}
