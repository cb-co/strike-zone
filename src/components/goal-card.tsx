'use client'

import { useState } from 'react'
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateGoal, deleteGoal } from '@/actions/goals'
import { monthlyBreakdown, expectedCumPnL } from '@/lib/goals'
import { formatCurrency } from '@/lib/format'
import Link from 'next/link'
import { Figure, Punctuality, RouteLine } from '@/components/goal-timetable'
import { Key } from '@/components/equity-chart'

export type GoalCardData = {
  id: string
  year: number
  accountId: string
  accountName: string
  goalAmount: number
  curveFactor: number
  monthlyFixedWd: number
  monthlyVariableWdPct: number
  actualMonthlyPnl: number[] // 12 values, index 0 = Jan
}

export function GoalCard({ goal }: { goal: GoalCardData }) {
  const [editOpen, setEditOpen] = useState(false)
  const currentYear = new Date().getFullYear()
  const isPast = goal.year < currentYear

  const breakdown = monthlyBreakdown({
    goalAmount: goal.goalAmount,
    curveFactor: goal.curveFactor,
    monthlyFixedWd: goal.monthlyFixedWd,
    monthlyVariableWdPct: goal.monthlyVariableWdPct,
  })

  const goalParams = {
    goalAmount: goal.goalAmount,
    curveFactor: goal.curveFactor,
    monthlyFixedWd: goal.monthlyFixedWd,
    monthlyVariableWdPct: goal.monthlyVariableWdPct,
  }
  const expectedYTD = expectedCumPnL(goalParams, new Date())
  const actualYTD = goal.actualMonthlyPnl.slice(0, new Date().getMonth() + 1).reduce((s, v) => s + v, 0)
  const gap = actualYTD - expectedYTD

  const actualPct = Math.min(1, actualYTD / goal.goalAmount)
  const expectedPct = Math.min(1, expectedYTD / goal.goalAmount)

  const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  const chartData = breakdown.map((b, i) => ({
    idx: i,
    month: MONTHS[i],
    expected: b.expectedPnl,
    actual: goal.actualMonthlyPnl[i] ?? 0,
  }))

  if (isPast) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg ring-1 ring-border bg-card/60 px-5 py-3.5">
        <div className="flex items-baseline gap-3">
          <span className="font-heading text-[18px] font-semibold tabular-nums">{goal.year}</span>
          <span className="text-[13px] text-muted-foreground">{goal.accountName}</span>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="secondary">Completed</Badge>
          <span className="text-[13px] tabular-nums">
            <span className={`font-semibold ${actualYTD >= 0 ? 'text-gain' : 'text-loss'}`}>{formatCurrency(actualYTD)}</span>
            <span className="text-muted-foreground"> of {formatCurrency(goal.goalAmount)}</span>
          </span>
        </div>
      </div>
    )
  }

  return (
    <article className="rounded-lg ring-1 ring-border bg-card shadow-[0_1px_2px_oklch(0.2_0.02_262/0.06)] p-5 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-3">
          <h2 className="text-[24px] leading-none font-semibold tabular-nums">{goal.year}</h2>
          <span className="text-[14px] text-muted-foreground">{goal.accountName}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[13px] text-muted-foreground">Goal <span className="font-semibold text-foreground tabular-nums">{formatCurrency(goal.goalAmount)}</span></span>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline">Edit goal</Button></DialogTrigger>
            <DialogContent aria-describedby={undefined}>
              <DialogHeader><DialogTitle>Edit Goal</DialogTitle></DialogHeader>
              <form action={(fd) => {
                const raw = parseFloat(fd.get('monthlyVariableWdPct') as string) || 0
                fd.set('monthlyVariableWdPct', String(raw / 100))
                return updateGoal(goal.id, fd).then(() => setEditOpen(false))
              }} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="goalAmount">Goal Amount</Label>
                    <Input id="goalAmount" name="goalAmount" type="number" step="any" defaultValue={goal.goalAmount} required />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="curveFactor">Curve Factor</Label>
                    <Input id="curveFactor" name="curveFactor" type="number" step="0.1" defaultValue={goal.curveFactor} required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="monthlyFixedWd">Monthly Fixed WD</Label>
                    <Input id="monthlyFixedWd" name="monthlyFixedWd" type="number" step="any" defaultValue={goal.monthlyFixedWd} />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="monthlyVariableWdPct">Variable WD %</Label>
                    <Input id="monthlyVariableWdPct" name="monthlyVariableWdPct" type="number" step="1" placeholder="10" defaultValue={goal.monthlyVariableWdPct * 100} />
                  </div>
                </div>
                <input type="hidden" name="accountId" value={goal.accountId} />
                <input type="hidden" name="year" value={goal.year} />
                <div className="flex justify-between">
                  <Button type="button" variant="destructive" size="sm" onClick={() => deleteGoal(goal.id).then(() => setEditOpen(false))}>Delete</Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
                    <Button type="submit">Save</Button>
                  </div>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <dl className="grid grid-cols-3 gap-6 max-w-lg flex-1">
          <Figure label="Actual YTD" value={formatCurrency(actualYTD)} tone={actualYTD >= 0 ? 'gain' : 'loss'} />
          <Figure label="Scheduled YTD" value={formatCurrency(expectedYTD)} />
          <Figure label="Gap" value={`${gap > 0 ? '+' : ''}${formatCurrency(gap)}`} tone={gap >= 0 ? 'gain' : 'loss'} />
        </dl>
        <Punctuality gap={gap} />
      </div>

      {/* Route */}
      <RouteLine
        trainPos={Math.max(0, actualPct)}
        schedPos={Math.max(0, expectedPct)}
        curveFactor={goal.curveFactor}
        monthIndex={goal.year === currentYear ? new Date().getMonth() : -1}
      />
      <p className="-mt-2 text-[13px] text-muted-foreground tabular-nums">
        {(Math.max(0, actualPct) * 100).toFixed(1)}% of the goal reached, {(Math.max(0, expectedPct) * 100).toFixed(1)}% scheduled by today.
      </p>

      {/* Mini bar chart */}
      <div className="flex items-center gap-5">
        <Key bar color="var(--chart-1)" label="Actual P&L by month" />
        <Key bar color="color-mix(in oklch, var(--muted-foreground) 45%, transparent)" label="Scheduled" />
      </div>
      <div className="h-36 -mt-2">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={2} barCategoryGap="25%">
            <XAxis
              dataKey="idx"
              tickFormatter={(idx) => MONTHS[idx as number]}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)', fontWeight: 600 }}
              tickLine={false}
              axisLine={false}
            />
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <YAxis
              width={44}
              tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${Number(v) < 0 ? '−' : ''}$${Math.abs(Number(v) / 1000).toFixed(0)}k`}
            />
            <ReferenceLine y={0} stroke="var(--foreground)" strokeOpacity={0.35} strokeWidth={1} />
            <Bar isAnimationActive={false} dataKey="expected" name="Scheduled" fill="var(--muted-foreground)" opacity={0.3} radius={[1, 1, 0, 0]} />
            <Bar isAnimationActive={false} dataKey="actual" name="Actual" fill="var(--chart-1)" radius={[1, 1, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.actual >= 0 ? 'var(--chart-1)' : 'var(--loss)'} />
              ))}
            </Bar>
            <Tooltip
              cursor={{ fill: 'var(--accent)', opacity: 0.6 }}
              contentStyle={{
                backgroundColor: 'var(--popover)',
                borderColor: 'var(--border)',
                color: 'var(--popover-foreground)',
                borderRadius: '4px',
                fontSize: '12px',
              }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              itemStyle={{ color: 'var(--popover-foreground)' }}
              formatter={(value, name) => [formatCurrency(Number(value)), name]}
              labelFormatter={(idx) => MONTHS[idx as number]}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-muted-foreground border-t pt-4">
        <div className="flex flex-wrap gap-x-5 gap-y-1 tabular-nums">
          <span>Fixed withdrawal <span className="text-foreground font-medium">{formatCurrency(goal.monthlyFixedWd)}/mo</span></span>
          <span>Variable withdrawal <span className="text-foreground font-medium">{(goal.monthlyVariableWdPct * 100).toFixed(0)}%</span></span>
          <span>Curve <span className="text-foreground font-medium">{goal.curveFactor}</span></span>
        </div>
        <Link href={`/monthly?goalId=${goal.id}`} className="text-primary font-semibold hover:underline">
          Monthly breakdown
        </Link>
      </div>
    </article>
  )
}
