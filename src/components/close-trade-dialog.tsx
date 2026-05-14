'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/date-picker'
import { closeTrade } from '@/actions/trades'

export type CloseTradeTrade = {
  id: string
  ticker: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entryPrice: number
  quantity: number
  contractSize: number | null
  optionType: 'CALL' | 'PUT' | null
  projectedProfit: number | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trade: CloseTradeTrade
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export function CloseTradeDialog({ open, onOpenChange, trade }: Props) {
  const [exitPrice, setExitPrice] = useState('')
  const [closeDate, setCloseDate] = useState(today())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mult = trade.contractSize ?? 1
  const exitP = parseFloat(exitPrice) || 0
  const pnl = exitP > 0
    ? trade.side === 'SHORT'
      ? (trade.entryPrice - exitP) * trade.quantity * mult
      : (exitP - trade.entryPrice) * trade.quantity * mult
    : null

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const price = parseFloat(exitPrice)
    if (isNaN(price)) return
    setLoading(true)
    setError(null)
    try {
      await closeTrade(trade.id, price, closeDate)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to close trade')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Close {trade.ticker}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Symbol</span>
              <span className="font-mono">{trade.symbol}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Entry / collected</span>
              <span className="font-mono">
                ${trade.entryPrice.toFixed(4)}
                {trade.projectedProfit != null && ` · $${trade.projectedProfit.toFixed(2)} total`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Exit price</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={exitPrice}
                onChange={(e) => setExitPrice(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Close date</Label>
              <DatePicker name="closeDate" value={closeDate} onValueChange={setCloseDate} />
            </div>
          </div>

          {pnl !== null && (
            <div className="rounded-md border px-3 py-2 text-xs flex justify-between">
              <span className="text-muted-foreground">Est. P&L</span>
              <span className={`font-mono font-medium ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {pnl >= 0 ? '+' : ''}${pnl.toFixed(2)}
              </span>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Closing…' : 'Close Trade'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
