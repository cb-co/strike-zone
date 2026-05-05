'use client'

import { useState } from 'react'
import { BarChart, Bar, Cell, XAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateGoal, deleteGoal } from '@/actions/goals'
import { monthlyBreakdown } from '@/lib/goals'
import Link from 'next/link'

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

  const expectedYTD = breakdown.slice(0, new Date().getMonth() + 1).reduce((s, b) => s + b.expectedPnl, 0)
  const actualYTD = goal.actualMonthlyPnl.reduce((s, v) => s + v, 0)
  const gap = actualYTD - expectedYTD

  const actualPct = Math.min(1, actualYTD / goal.goalAmount)
  const expectedPct = Math.min(1, expectedYTD / goal.goalAmount)

  const MONTHS = ['J','F','M','A','M','J','J','A','S','O','N','D']
  const chartData = breakdown.map((b, i) => ({
    month: MONTHS[i],
    expected: b.expectedPnl,
    actual: goal.actualMonthlyPnl[i] ?? 0,
  }))

  if (isPast) {
    return (
      <div className="rounded-lg border p-4 opacity-70">
        <div className="flex items-center justify-between">
          <div>
            <span className="font-semibold">{goal.year}</span>
            <span className="ml-2 text-sm text-muted-foreground">{goal.accountName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">COMPLETED</Badge>
            <span className={`font-medium text-sm ${actualYTD >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${actualYTD.toFixed(2)} / ${goal.goalAmount.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-lg font-semibold">{goal.year}</span>
          <span className="ml-2 text-muted-foreground">{goal.accountName}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Goal: <span className="font-medium text-foreground">${goal.goalAmount.toLocaleString()}</span></span>
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogTrigger asChild><Button size="sm" variant="outline">Edit</Button></DialogTrigger>
            <DialogContent>
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
      <div className="grid grid-cols-3 gap-4 text-sm">
        <div>
          <p className="text-muted-foreground">Actual YTD</p>
          <p className={`font-semibold text-base ${actualYTD >= 0 ? 'text-green-600' : 'text-red-600'}`}>${actualYTD.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Expected YTD</p>
          <p className="font-semibold text-base">${expectedYTD.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Gap</p>
          <p className={`font-semibold text-base ${gap >= 0 ? 'text-green-600' : 'text-red-600'}`}>{gap >= 0 ? '+' : ''}${gap.toFixed(2)}</p>
        </div>
      </div>

      {/* Progress bars */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Actual</span>
          <div className="flex-1 bg-muted rounded-full h-2">
            <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${actualPct * 100}%` }} />
          </div>
          <span>{(actualPct * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Expected</span>
          <div className="flex-1 bg-muted rounded-full h-2">
            <div className="bg-blue-400 h-2 rounded-full transition-all" style={{ width: `${expectedPct * 100}%` }} />
          </div>
          <span>{(expectedPct * 100).toFixed(1)}%</span>
        </div>
      </div>

      {/* Mini bar chart */}
      <div className="h-24">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }} barGap={2} barCategoryGap="25%">
            <XAxis
              dataKey="month"
              tick={{ fontSize: 9, fill: 'var(--muted-foreground)' }}
              tickLine={false}
              axisLine={false}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeWidth={1} />
            <Bar dataKey="expected" fill="#9ca3af" opacity={0.45} radius={[2, 2, 0, 0]} />
            <Bar dataKey="actual" fill="#3b82f6" radius={[2, 2, 0, 0]}>
              {chartData.map((d, i) => (
                <Cell key={i} fill={d.actual >= 0 ? '#3b82f6' : '#ef4444'} />
              ))}
            </Bar>
            <Tooltip
              cursor={false}
              contentStyle={{
                backgroundColor: 'var(--popover)',
                borderColor: 'var(--border)',
                color: 'var(--popover-foreground)',
                borderRadius: '6px',
                fontSize: '11px',
              }}
              labelStyle={{ color: 'var(--muted-foreground)' }}
              itemStyle={{ color: 'var(--popover-foreground)' }}
              formatter={(value, name) => [`$${Number(value).toFixed(0)}`, name === 'actual' ? 'Actual' : 'Expected']}
              labelFormatter={(label) => label}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-sm text-muted-foreground border-t pt-3">
        <div className="flex gap-4">
          <span>Fixed WD: ${goal.monthlyFixedWd}/mo</span>
          <span>Var WD: {(goal.monthlyVariableWdPct * 100).toFixed(0)}%</span>
          <span>Curve: {goal.curveFactor}</span>
        </div>
        <Link href={`/monthly?goalId=${goal.id}`} className="text-primary hover:underline text-xs">
          Monthly breakdown →
        </Link>
      </div>
    </div>
  )
}
