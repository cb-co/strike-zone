import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/format'
import { eom } from '@/lib/goals'

const MONTH_INITIALS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D']

function clamp01(n: number) {
  return Math.max(0, Math.min(1, n))
}

/** "Ahead of timetable by $1,204" / "Behind timetable by $830" */
export function Punctuality({ gap }: { gap: number }) {
  const ahead = gap >= 0
  return (
    <p className="text-[13px]">
      <span className={cn('font-semibold tabular-nums', ahead ? 'text-gain' : 'text-loss')}>
        {formatCurrency(Math.abs(gap))} {ahead ? 'ahead of' : 'behind'}
      </span>
      <span className="text-muted-foreground"> timetable</span>
    </p>
  )
}

export function Figure({ label, value, tone }: { label: string; value: string; tone?: 'gain' | 'loss' }) {
  return (
    <div className="min-w-0">
      <dt className="sign-caps text-[10.5px] text-muted-foreground">{label}</dt>
      <dd className={cn('mt-0.5 text-[15px] font-semibold tabular-nums truncate', tone === 'gain' && 'text-gain', tone === 'loss' && 'text-loss')}>
        {value}
      </dd>
    </div>
  )
}

type Props = {
  year: number
  monthIndex: number // 0-11
  monthLabel: string
  monthActual: number
  monthExpected: number
  ytdActual: number
  ytdExpected: number
  goalAmount: number
  curveFactor: number
}

/**
 * The goal as a line diagram: twelve monthly stops placed where the goal curve
 * says each month should end, the book's marker where it actually is, and an
 * ink tick where the timetable says it should be today.
 */
export function GoalTimetable(p: Props) {
  const monthGap = p.monthActual - p.monthExpected
  const monthPct = p.monthExpected > 0 ? clamp01(p.monthActual / p.monthExpected) : 0
  const ytdGap = p.ytdActual - p.ytdExpected
  const trainPos = p.goalAmount > 0 ? clamp01(p.ytdActual / p.goalAmount) : 0
  const schedPos = p.goalAmount > 0 ? clamp01(p.ytdExpected / p.goalAmount) : 0
  const signedMoney = (n: number) => `${n > 0 ? '+' : ''}${formatCurrency(n)}`

  return (
    <div className="space-y-7">
      {/* This month */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] leading-tight font-semibold">{p.monthLabel} timetable</h2>
          <Punctuality gap={monthGap} />
        </div>
        <dl className="grid grid-cols-3 gap-3">
          <Figure label="Actual" value={signedMoney(p.monthActual)} tone={p.monthActual >= 0 ? 'gain' : 'loss'} />
          <Figure label="Scheduled" value={formatCurrency(p.monthExpected)} />
          <Figure label="Gap" value={signedMoney(monthGap)} tone={monthGap >= 0 ? 'gain' : 'loss'} />
        </dl>
        {p.monthExpected > 0 && (
          <div className="flex items-center gap-3">
            <div
              className="relative flex-1 h-2 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-label={`${p.monthLabel} progress to scheduled amount`}
              aria-valuenow={Math.round(monthPct * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${monthPct * 100}%` }} />
            </div>
            <span className="w-10 text-right text-[12px] font-semibold tabular-nums">{Math.round(monthPct * 100)}%</span>
          </div>
        )}
      </div>

      {/* The year as a route */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-[17px] leading-tight font-semibold">{p.year} route</h2>
          <Punctuality gap={ytdGap} />
        </div>

        <RouteLine trainPos={trainPos} schedPos={schedPos} curveFactor={p.curveFactor} monthIndex={p.monthIndex} />

        <dl className="grid grid-cols-3 gap-3">
          <Figure label="Year to date" value={signedMoney(p.ytdActual)} tone={p.ytdActual >= 0 ? 'gain' : 'loss'} />
          <Figure label="Scheduled" value={formatCurrency(p.ytdExpected)} />
          <Figure label="Goal" value={formatCurrency(p.goalAmount)} />
        </dl>
        <p className="text-[13px] text-muted-foreground">
          {Math.round(trainPos * 100)}% of the way, {Math.round(schedPos * 100)}% scheduled by today.{' '}
          <Link href="/monthly" className="text-primary font-medium hover:underline">Monthly breakdown</Link>
        </p>
      </div>
    </div>
  )
}

/**
 * The year drawn as a line diagram. Stops sit where the goal curve says each
 * month should end; the ringed marker is the book, the ink tick is the schedule.
 */
export function RouteLine({
  trainPos,
  schedPos,
  curveFactor,
  monthIndex,
}: {
  trainPos: number
  schedPos: number
  curveFactor: number
  /** Highlight this month's stop; -1 for none. */
  monthIndex: number
}) {
  const stops = MONTH_INITIALS.map((m, i) => ({ m, pos: eom(i + 1, curveFactor), i }))
  return (
    <div className="pt-7 pb-6 px-1.5" aria-hidden>
      <div className="relative h-1.5">
        <div className="absolute inset-0 rounded-full bg-muted ring-1 ring-inset ring-border" />
        <div className="absolute inset-y-0 left-0 rounded-full bg-primary" style={{ width: `${trainPos * 100}%` }} />
        {stops.map((s) => (
          <div key={s.i} className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ left: `${s.pos * 100}%` }}>
            <div
              className={cn(
                'size-2.5 rounded-full ring-2 ring-card',
                s.pos <= trainPos ? 'bg-primary' : 'bg-card border border-foreground/40',
              )}
            />
            <div
              className={cn(
                'absolute top-3.5 left-1/2 -translate-x-1/2 text-[10px] font-semibold',
                s.i === monthIndex ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              {s.m}
            </div>
          </div>
        ))}
        <div className="absolute -top-6 -translate-x-1/2 flex flex-col items-center" style={{ left: `${schedPos * 100}%` }}>
          <span className="sign-caps text-[9.5px] text-muted-foreground leading-none mb-1">Sched.</span>
          <span className="w-[2px] h-5 rounded-full bg-foreground" />
        </div>
        <div
          className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 size-4 rounded-full bg-card ring-[4px] ring-primary shadow-[0_1px_3px_oklch(0.2_0.05_262/0.4)]"
          style={{ left: `${trainPos * 100}%` }}
        />
      </div>
    </div>
  )
}
