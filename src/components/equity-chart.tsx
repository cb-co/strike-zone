'use client'

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

export type EquityDataPoint = {
  month: string
  actual: number
  expected: number | null
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--popover)',
  borderColor: 'var(--border)',
  color: 'var(--popover-foreground)',
  borderRadius: '6px',
  fontSize: '12px',
}

export function EquityChart({ data }: { data: EquityDataPoint[] }) {
  const hasExpected = data.some((d) => d.expected !== null)

  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
        <XAxis
          dataKey="month"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) => [
            `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
            name,
          ]}
        />
        {hasExpected && <Legend wrapperStyle={{ fontSize: '12px' }} />}
        {hasExpected && (
          <Area
            type="monotone"
            dataKey="expected"
            stroke="var(--muted-foreground)"
            strokeDasharray="5 5"
            strokeWidth={1.5}
            fill="none"
            name="Expected"
          />
        )}
        <Area
          type="monotone"
          dataKey="actual"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#actualGrad)"
          name="Actual"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
