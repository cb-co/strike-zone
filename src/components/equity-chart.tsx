'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'

export type EquityDataPoint = {
  month: string
  actual: number | null
  expected: number | null
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  color: 'var(--popover-foreground)',
  borderRadius: '4px',
  fontSize: '12px',
  boxShadow: '0 8px 24px -12px oklch(0.2 0.06 262 / 0.45)',
  fontVariantNumeric: 'tabular-nums',
}

export function Key({ dashed, bar, color, label }: { dashed?: boolean; bar?: boolean; color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-[12px] text-muted-foreground">
      {bar ? (
        <svg width="10" height="10" aria-hidden><rect width="10" height="10" rx="1" fill={color} /></svg>
      ) : (
        <svg width="20" height="6" aria-hidden>
          <line x1="0" y1="3" x2="20" y2="3" stroke={color} strokeWidth={dashed ? 1.5 : 2.5} strokeDasharray={dashed ? '4 3' : undefined} />
        </svg>
      )}
      {label}
    </span>
  )
}

export function EquityChart({ data }: { data: EquityDataPoint[] }) {
  const hasExpected = data.some((d) => d.expected !== null)

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-5">
        <Key color="var(--chart-1)" label="Account equity" />
        {hasExpected && <Key dashed color="var(--muted-foreground)" label="Goal timetable" />}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -4 }}>
          <CartesianGrid vertical={false} stroke="var(--border)" />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)', fontWeight: 600 }}
            tickLine={false}
            axisLine={{ stroke: 'var(--border)' }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={tooltipStyle}
            labelStyle={{ fontWeight: 600, marginBottom: 2 }}
            cursor={{ stroke: 'var(--foreground)', strokeOpacity: 0.2 }}
            formatter={(value, name) => [
              `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
              name,
            ]}
          />
          {hasExpected && (
            <Area
              type="monotone"
              dataKey="expected"
              stroke="var(--muted-foreground)"
              strokeDasharray="5 4"
              strokeWidth={1.5}
              fill="none"
              name="Goal timetable"
              isAnimationActive={false}
            />
          )}
          <Area
            type="monotone"
            dataKey="actual"
            stroke="var(--chart-1)"
            strokeWidth={2.5}
            fill="var(--chart-1)"
            fillOpacity={0.08}
            name="Account equity"
            connectNulls={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: 'var(--card)', stroke: 'var(--chart-1)', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}
