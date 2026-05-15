'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { parseQfx, mergeSplitFills, mergeStockFills, type MergedTx, type MergedStockTx } from '@/lib/qfx'
import { importQfxTrades, revertImport, type ImportRecord, type ImportResult } from '@/actions/import-trades'
import { cn } from '@/lib/utils'

type Account = { id: string; name: string }
type Props = { accounts: Account[] }
type Phase = 'idle' | 'preview' | 'importing' | 'done'

function processFile(
  file: File,
  onSuccess: (merged: MergedTx[], stockMerged: MergedStockTx[], errors: string[], dateRange: { start: string; end: string }) => void,
  onError: (msg: string) => void
) {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'qfx' && ext !== 'ofx') {
    onError('Please upload a .qfx or .ofx file from TradeStation')
    return
  }
  const reader = new FileReader()
  reader.onload = (ev) => {
    const content = ev.target?.result as string
    try {
      const parsed = parseQfx(content)
      if (parsed.transactions.length === 0 && parsed.stockTransactions.length === 0) {
        onError('No transactions found in this file')
        return
      }
      onSuccess(
        mergeSplitFills(parsed.transactions),
        mergeStockFills(parsed.stockTransactions),
        parsed.errors,
        parsed.dateRange,
      )
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to parse file')
    }
  }
  reader.readAsText(file)
}

const ACTION_LABEL: Record<string, string> = {
  SELLTOOPEN:  'Short Open',
  BUYTOOPEN:   'Long Open',
  BUYTOCLOSE:  'Buy Close',
  SELLTOCLOSE: 'Sell Close',
}

function UndoImportButton({ batchId, onUndone }: { batchId: string; onUndone: () => void }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleUndo() {
    setLoading(true)
    setError(null)
    try {
      await revertImport(batchId)
      onUndone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Undo failed')
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" onClick={handleUndo} disabled={loading} className="text-destructive hover:text-destructive">
        {loading ? 'Undoing…' : 'Undo Import'}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}

export function ImportQfxButton({ accounts }: Props) {
  const [open, setOpen]           = useState(false)
  const [phase, setPhase]         = useState<Phase>('idle')
  const [merged, setMerged]       = useState<MergedTx[]>([])
  const [stockMerged, setStockMerged] = useState<MergedStockTx[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' })
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? '')
  const [result, setResult]       = useState<ImportResult | null>(null)
  const [error, setError]         = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function reset() {
    setPhase('idle')
    setMerged([])
    setStockMerged([])
    setParseErrors([])
    setDateRange({ start: '', end: '' })
    setResult(null)
    setError(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  function handleOpenChange(v: boolean) {
    setOpen(v)
    if (!v) reset()
  }

  function handleSuccess(m: MergedTx[], sm: MergedStockTx[], errs: string[], dr: { start: string; end: string }) {
    setMerged(m)
    setStockMerged(sm)
    setParseErrors(errs)
    setDateRange(dr)
    setPhase('preview')
    setError(null)
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    processFile(file, handleSuccess, setError)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    processFile(file, handleSuccess, setError)
  }

  async function handleImport() {
    setPhase('importing')
    setError(null)
    try {
      const optionRecords: ImportRecord[] = merged.map((tx) => ({
        instrumentType: 'OPTION',
        symbol:       tx.symbol,
        ticker:       tx.ticker,
        optionType:   tx.optionType,
        strike:       tx.strike,
        expiration:   tx.expiration,
        quantity:     tx.contracts,
        unitPrice:    tx.unitPrice,
        commission:   tx.commission,
        date:         tx.tradeDate,
        action:       tx.action,
        netTotal:     tx.netTotal,
        contractSize: tx.contractSize,
      }))
      const stockRecords: ImportRecord[] = stockMerged.map((tx) => ({
        instrumentType: 'STOCK',
        symbol:         tx.ticker,
        ticker:         tx.ticker,
        quantity:       tx.quantity,
        unitPrice:      tx.unitPrice,
        commission:     tx.commission,
        date:           tx.tradeDate,
        action:         tx.action,
        netTotal:       tx.netTotal,
        contractSize:   1,
        isAssignment:   tx.isAssignment,
      }))
      const records = [...optionRecords, ...stockRecords]
      const res = await importQfxTrades(accountId, records, dateRange.end)
      setResult(res)
      setPhase('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
      setPhase('preview')
    }
  }

  const opens       = merged.filter((t) => t.action === 'SELLTOOPEN'  || t.action === 'BUYTOOPEN')
  const closes      = merged.filter((t) => t.action === 'BUYTOCLOSE'  || t.action === 'SELLTOCLOSE')
  const assignments = stockMerged.filter((t) => t.isAssignment)
  const regularStocks = stockMerged.filter((t) => !t.isAssignment)

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>Import QFX</Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent aria-describedby={undefined} className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import QFX / OFX</DialogTitle>
          </DialogHeader>

          {/* ── Idle: file picker ── */}
          {phase === 'idle' && (
            <div className="space-y-4">
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-10 text-center cursor-pointer transition-colors',
                  isDragOver ? 'border-primary bg-primary/5' : 'hover:bg-muted/30',
                )}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true) }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={handleDrop}
              >
                <p className="text-sm font-medium">{isDragOver ? 'Drop to import' : 'Click or drag file here'}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Accepts <span className="font-mono">.qfx</span> or <span className="font-mono">.ofx</span> exported from TradeStation
                </p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".qfx,.ofx"
                className="hidden"
                onChange={handleFile}
              />
              {error && <p className="text-sm text-destructive">{error}</p>}
            </div>
          )}

          {/* ── Preview ── */}
          {phase === 'preview' && (
            <div className="space-y-4">
              {/* Summary chips */}
              <div className="flex items-center gap-3 text-xs">
                <span className="rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 px-2.5 py-0.5 font-medium">
                  {opens.length} opens
                </span>
                <span className="rounded-full bg-rose-50 text-rose-700 ring-1 ring-rose-200 px-2.5 py-0.5 font-medium">
                  {closes.length} closes
                </span>
                {regularStocks.length > 0 && (
                  <span className="rounded-full bg-blue-50 text-blue-700 ring-1 ring-blue-200 px-2.5 py-0.5 font-medium">
                    {regularStocks.length} stocks
                  </span>
                )}
                {assignments.length > 0 && (
                  <span className="rounded-full bg-violet-50 text-violet-700 ring-1 ring-violet-200 px-2.5 py-0.5 font-medium">
                    {assignments.length} assigned
                  </span>
                )}
                {parseErrors.length > 0 && (
                  <span className="rounded-full bg-amber-50 text-amber-700 ring-1 ring-amber-200 px-2.5 py-0.5 font-medium">
                    {parseErrors.length} warnings
                  </span>
                )}
              </div>

              {/* Account selector */}
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Import into account</p>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Preview table */}
              {(() => {
                type OptionRow = MergedTx & { _type: 'option' }
                type StockRow = MergedStockTx & { _type: 'stock' }
                type CombinedRow = OptionRow | StockRow

                const optionRows: OptionRow[] = merged.map((tx) => ({ ...tx, _type: 'option' as const }))
                const stockRows: StockRow[] = stockMerged.map((tx) => ({ ...tx, _type: 'stock' as const }))
                const allRows: CombinedRow[] = [...optionRows, ...stockRows].sort((a, b) => {
                  if (a.tradeDate < b.tradeDate) return -1
                  if (a.tradeDate > b.tradeDate) return 1
                  return 0
                })

                return (
                  <div className="rounded-md border overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="border-b bg-muted/50">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Symbol</th>
                          <th className="px-3 py-2 text-left font-medium text-muted-foreground">Action</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Qty</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Avg Price</th>
                          <th className="px-3 py-2 text-right font-medium text-muted-foreground">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {allRows.map((tx, i) => {
                          if (tx._type === 'stock') {
                            const isBuy = tx.action === 'BUY'
                            return (
                              <tr key={`s-${i}`} className="hover:bg-muted/30 transition-colors">
                                <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                                  {new Date(tx.tradeDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                </td>
                                <td className="px-3 py-1.5 font-mono">{tx.ticker}</td>
                                <td className="px-3 py-1.5">
                                  {tx.isAssignment ? (
                                    <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 bg-violet-50 text-violet-700 ring-violet-200">
                                      Assigned
                                    </span>
                                  ) : (
                                    <span className={cn(
                                      'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
                                      isBuy ? 'bg-blue-50 text-blue-700 ring-blue-200' : 'bg-muted/80 text-muted-foreground ring-border',
                                    )}>
                                      {isBuy ? 'Buy' : 'Sell'}
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums">{tx.quantity}</td>
                                <td className="px-3 py-1.5 text-right tabular-nums">${tx.unitPrice.toFixed(2)}</td>
                                {tx.isAssignment ? (
                                  <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>
                                ) : (
                                  <td className={cn(
                                    'px-3 py-1.5 text-right tabular-nums font-medium',
                                    tx.netTotal >= 0 ? 'text-emerald-600' : 'text-rose-600',
                                  )}>
                                    {tx.netTotal >= 0 ? '+' : ''}${Math.abs(tx.netTotal).toFixed(2)}
                                  </td>
                                )}
                              </tr>
                            )
                          }

                          const isOpen = tx.action === 'SELLTOOPEN' || tx.action === 'BUYTOOPEN'
                          const isShortOpen = tx.action === 'SELLTOOPEN'
                          return (
                            <tr key={`o-${i}`} className="hover:bg-muted/30 transition-colors">
                              <td className="px-3 py-1.5 tabular-nums text-muted-foreground">
                                {new Date(tx.tradeDate + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                              </td>
                              <td className="px-3 py-1.5 font-mono">{tx.symbol}</td>
                              <td className="px-3 py-1.5">
                                <span className={cn(
                                  'inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1',
                                  isShortOpen ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
                                  isOpen      ? 'bg-blue-50    text-blue-700    ring-blue-200'    :
                                                'bg-rose-50    text-rose-700    ring-rose-200',
                                )}>
                                  {ACTION_LABEL[tx.action]}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">{tx.contracts}</td>
                              <td className="px-3 py-1.5 text-right tabular-nums">${tx.unitPrice.toFixed(2)}</td>
                              <td className={cn(
                                'px-3 py-1.5 text-right tabular-nums font-medium',
                                tx.netTotal >= 0 ? 'text-emerald-600' : 'text-rose-600',
                              )}>
                                {tx.netTotal >= 0 ? '+' : ''}${Math.abs(tx.netTotal).toFixed(2)}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              })()}

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => handleOpenChange(false)}>Cancel</Button>
                <Button onClick={handleImport} disabled={(merged.length === 0 && stockMerged.length === 0) || !accountId}>
                  Import {merged.length + regularStocks.length + assignments.length} records
                </Button>
              </div>
            </div>
          )}

          {/* ── Importing ── */}
          {phase === 'importing' && (
            <div className="py-10 text-center text-sm text-muted-foreground">Importing…</div>
          )}

          {/* ── Done ── */}
          {phase === 'done' && result && (
            <div className="space-y-4">
              <div className="rounded-md border divide-y text-sm">
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Trades created</span>
                  <span className="font-semibold text-emerald-600">{result.created}</span>
                </div>
                <div className="flex justify-between px-4 py-2.5">
                  <span className="text-muted-foreground">Trades closed</span>
                  <span className="font-semibold">{result.closed}</span>
                </div>
                {result.expired > 0 && (
                  <div className="flex justify-between px-4 py-2.5">
                    <span className="text-muted-foreground">Expired worthless (auto-closed at $0)</span>
                    <span className="font-semibold text-muted-foreground">{result.expired}</span>
                  </div>
                )}
                {result.skipped.length > 0 && (
                  <div className="px-4 py-2.5 space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">No open match</span>
                      <span className="font-semibold text-amber-600">{result.skipped.length}</span>
                    </div>
                    <div className="flex flex-wrap gap-1 pt-0.5">
                      {result.skipped.map((sym) => (
                        <span key={sym} className="font-mono text-[10px] bg-amber-50 text-amber-700 ring-1 ring-amber-200 rounded px-1.5 py-0.5">{sym}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-between items-center">
                <UndoImportButton batchId={result.batchId} onUndone={() => handleOpenChange(false)} />
                <Button onClick={() => handleOpenChange(false)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
