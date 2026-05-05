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
  expected: number
}

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--popover)',
  borderColor: 'var(--border)',
  color: 'var(--popover-foreground)',
  borderRadius: '6px',
  fontSize: '12px',
}

export function EquityChart({ data }: { data: EquityDataPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="var(--primary)" stopOpacity={0.3} />
            <stop offset="95%" stopColor="var(--primary)" stopOpacity={0} />
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
            name === 'actual' ? 'Actual' : 'Expected',
          ]}
        />
        <Legend wrapperStyle={{ fontSize: '12px' }} />
        <Area
          type="monotone"
          dataKey="expected"
          stroke="var(--muted-foreground)"
          strokeDasharray="5 5"
          strokeWidth={1.5}
          fill="none"
          name="Expected"
        />
        <Area
          type="monotone"
          dataKey="actual"
          stroke="var(--primary)"
          strokeWidth={2}
          fill="url(#actualGrad)"
          name="Actual"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
