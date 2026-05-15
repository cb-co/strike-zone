'use client'

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from '@tanstack/react-table'
import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { deleteTrade } from '@/actions/trades'
import { TradeForm, type TradeFormTrade } from '@/components/trade-form'
import { CloseTradeDialog } from '@/components/close-trade-dialog'
import { RollTradeDialog } from '@/components/roll-trade-dialog'

export type TableTrade = {
  id: string
  name: string
  ticker: string
  symbol: string
  side: 'LONG' | 'SHORT'
  quantity: number
  entryPrice: number
  openDate: Date
  source: 'MANUAL' | 'TS_IMPORT'
  exitPrice: number | null
  closeDate: Date | null
  projectedProfit: number | null
  netPnl: number | null
  notes: string | null
  optionType: 'CALL' | 'PUT' | null
  strike: number | null
  expiration: Date | null
  contractSize: number | null
  commission: number
  accountId: string
  tradeSetups: { setupId: string; setup: { name: string } }[]
}

type Props = {
  trades: TableTrade[]
  variant: 'closed' | 'open' | 'losses'
  accounts: { id: string; name: string; optionAssignmentFee: number }[]
  setups: { id: string; name: string }[]
}

function fmt(n: number | null | undefined, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function fmtDate(d: Date | string) {
  return new Date(d).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })
}

function daysSince(d: Date) {
  return Math.floor((Date.now() - new Date(d).getTime()) / 86_400_000)
}

function daysBetween(a: Date, b: Date) {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

export function TradesTable({ trades, variant, accounts, setups }: Props) {
  const [sorting, setSorting] = useState<SortingState>(
    variant === 'losses' ? [{ id: 'netPnl', desc: false }] : []
  )
  const [globalFilter, setGlobalFilter] = useState('')
  const [editTrade, setEditTrade] = useState<TableTrade | null>(null)
  const [closingTrade, setClosingTrade] = useState<TableTrade | null>(null)
  const [rollingTrade, setRollingTrade] = useState<TableTrade | null>(null)

  const filteredTrades = variant === 'losses'
    ? trades.filter((t) => (t.netPnl ?? 0) < 0)
    : trades

  const closedColumns: ColumnDef<TableTrade>[] = [
    { accessorKey: 'name', header: 'Name', size: 160 },
    {
      id: 'days',
      header: 'Days',
      cell: ({ row }) => {
        const t = row.original
        if (!t.closeDate) return '—'
        return daysBetween(t.openDate, t.closeDate)
      },
    },
    { accessorKey: 'openDate', header: 'Open', cell: ({ getValue }) => fmtDate(getValue() as Date) },
    { accessorKey: 'closeDate', header: 'Close', cell: ({ getValue }) => getValue() ? fmtDate(getValue() as Date) : '—' },
    { accessorKey: 'ticker', header: 'Ticker', cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span> },
    { accessorKey: 'symbol', header: 'Symbol', size: 180, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: 'quantity', header: 'Qty', cell: ({ getValue }) => fmt(getValue() as number, 0) },
    { accessorKey: 'entryPrice', header: 'Entry', cell: ({ getValue }) => `$${fmt(getValue() as number)}` },
    { accessorKey: 'exitPrice', header: 'Exit', cell: ({ getValue }) => getValue() ? `$${fmt(getValue() as number)}` : '—' },
    {
      accessorKey: 'netPnl',
      header: 'Net P&L',
      cell: ({ getValue }) => {
        const v = getValue() as number | null
        if (v == null) return '—'
        return <span className={v >= 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>${fmt(v)}</span>
      },
    },
    {
      accessorKey: 'side',
      header: 'Side',
      cell: ({ getValue }) => <Badge variant={getValue() === 'LONG' ? 'default' : 'secondary'}>{getValue() as string}</Badge>,
    },
    { accessorKey: 'expiration', header: 'Expiry', cell: ({ getValue }) => getValue() ? fmtDate(getValue() as Date) : '—' },
    {
      id: 'setups',
      header: 'Setups',
      cell: ({ row }) => row.original.tradeSetups.map((ts) => (
        <Badge key={ts.setupId} variant="outline" className="mr-1 text-xs">{ts.setup.name}</Badge>
      )),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      cell: ({ getValue }) => getValue() === 'TS_IMPORT'
        ? <Badge className="bg-blue-500 text-white text-xs">TS</Badge>
        : null,
    },
  ]

  const openColumns: ColumnDef<TableTrade>[] = [
    { accessorKey: 'name', header: 'Name', size: 160 },
    {
      id: 'daysOpen',
      header: 'Days Open',
      cell: ({ row }) => daysSince(row.original.openDate),
    },
    { accessorKey: 'openDate', header: 'Open Date', cell: ({ getValue }) => fmtDate(getValue() as Date) },
    { accessorKey: 'ticker', header: 'Ticker', cell: ({ getValue }) => <span className="font-mono">{getValue() as string}</span> },
    { accessorKey: 'symbol', header: 'Symbol', size: 180, cell: ({ getValue }) => <span className="font-mono text-xs">{getValue() as string}</span> },
    { accessorKey: 'quantity', header: 'Qty', cell: ({ getValue }) => fmt(getValue() as number, 0) },
    { accessorKey: 'entryPrice', header: 'Entry', cell: ({ getValue }) => `$${fmt(getValue() as number)}` },
    { accessorKey: 'projectedProfit', header: 'Proj. Profit', cell: ({ getValue }) => getValue() ? `$${fmt(getValue() as number)}` : '—' },
    {
      accessorKey: 'side',
      header: 'Side',
      cell: ({ getValue }) => <Badge variant={getValue() === 'LONG' ? 'default' : 'secondary'}>{getValue() as string}</Badge>,
    },
    { accessorKey: 'expiration', header: 'Expiry', cell: ({ getValue }) => getValue() ? fmtDate(getValue() as Date) : '—' },
    {
      id: 'setups',
      header: 'Setups',
      cell: ({ row }) => row.original.tradeSetups.map((ts) => (
        <Badge key={ts.setupId} variant="outline" className="mr-1 text-xs">{ts.setup.name}</Badge>
      )),
    },
    { accessorKey: 'notes', header: 'Notes', cell: ({ getValue }) => <span className="text-xs text-muted-foreground">{getValue() as string}</span> },
  ]

  const columns = variant === 'open' ? openColumns : closedColumns

  const table = useReactTable({
    data: filteredTrades,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    globalFilterFn: (row, _colId, value) => {
      const s = value.toLowerCase()
      return (
        row.original.ticker.toLowerCase().includes(s) ||
        row.original.name.toLowerCase().includes(s) ||
        row.original.symbol.toLowerCase().includes(s)
      )
    },
  })

  return (
    <div className="space-y-3">
      <Input
        placeholder="Search ticker, name, symbol…"
        value={globalFilter}
        onChange={(e) => setGlobalFilter(e.target.value)}
        className="max-w-xs"
      />
      <div className="rounded-md border overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-3 py-2 text-left font-medium cursor-pointer select-none whitespace-nowrap"
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(header.column.columnDef.header, header.getContext())}
                    {{ asc: ' ↑', desc: ' ↓' }[header.column.getIsSorted() as string] ?? ''}
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium">Actions</th>
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/30 transition-colors">
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-3 py-2 whitespace-nowrap">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => setEditTrade(row.original)}>Edit</Button>
                    {variant === 'open' && (
                      <Button size="sm" variant="outline" onClick={() => setClosingTrade(row.original)}>Close</Button>
                    )}
                    {variant === 'open' && row.original.optionType && (
                      <Button size="sm" variant="outline" onClick={() => setRollingTrade(row.original)}>Roll</Button>
                    )}
                    <Button size="sm" variant="destructive" onClick={() => deleteTrade(row.original.id)}>Del</Button>
                  </div>
                </td>
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-4 py-8 text-center text-muted-foreground">No trades</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {editTrade && (
        <TradeForm
          key={editTrade.id}
          open={!!editTrade}
          onOpenChange={(o) => { if (!o) setEditTrade(null) }}
          accounts={accounts}
          setups={setups}
          trade={editTrade as TradeFormTrade}
        />
      )}

      {closingTrade && (
        <CloseTradeDialog
          key={`close-${closingTrade.id}`}
          open={!!closingTrade}
          onOpenChange={(o) => { if (!o) setClosingTrade(null) }}
          trade={{
            id: closingTrade.id,
            ticker: closingTrade.ticker,
            symbol: closingTrade.symbol,
            side: closingTrade.side,
            entryPrice: closingTrade.entryPrice,
            quantity: closingTrade.quantity,
            contractSize: closingTrade.contractSize,
            optionType: closingTrade.optionType,
            projectedProfit: closingTrade.projectedProfit,
          }}
          assignmentFee={accounts.find(a => a.id === closingTrade.accountId)?.optionAssignmentFee ?? 0}
        />
      )}

      {rollingTrade && (
        <RollTradeDialog
          key={`roll-${rollingTrade.id}`}
          open={!!rollingTrade}
          onOpenChange={(o) => { if (!o) setRollingTrade(null) }}
          trade={{
            id: rollingTrade.id,
            ticker: rollingTrade.ticker,
            symbol: rollingTrade.symbol,
            side: rollingTrade.side,
            entryPrice: rollingTrade.entryPrice,
            quantity: rollingTrade.quantity,
            contractSize: rollingTrade.contractSize,
            optionType: rollingTrade.optionType,
            strike: rollingTrade.strike,
            expiration: rollingTrade.expiration ? new Date(rollingTrade.expiration).toISOString() : null,
            projectedProfit: rollingTrade.projectedProfit,
          }}
        />
      )}
    </div>
  )
}
