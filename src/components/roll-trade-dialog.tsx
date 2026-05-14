'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/date-picker'
import { rollTrade } from '@/actions/trades'

export type RollTradeTrade = {
  id: string
  ticker: string
  symbol: string
  side: 'LONG' | 'SHORT'
  entryPrice: number
  quantity: number
  contractSize: number | null
  optionType: 'CALL' | 'PUT' | null
  strike: number | null
  expiration: string | null
  projectedProfit: number | null
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  trade: RollTradeTrade
}

function today() {
  return new Date().toISOString().split('T')[0]
}

export function RollTradeDialog({ open, onOpenChange, trade }: Props) {
  const mult = trade.contractSize ?? 1
  const totalPremium = trade.entryPrice * trade.quantity * mult

  const [netCredit, setNetCredit] = useState('')
  const [newStrike, setNewStrike] = useState(String(trade.strike ?? ''))
  const [newExpiration, setNewExpiration] = useState('')
  const [newEntryPrice, setNewEntryPrice] = useState('')
  const [rollDate, setRollDate] = useState(today())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // netCredit is per-contract option price (e.g. 3.2 means $3.20/contract credit)
  const net = parseFloat(netCredit) || 0
  const newEntry = parseFloat(newEntryPrice) || 0

  // exitPrice = newEntry − netCreditPerContract  (for SHORT)
  const derivedExitPrice =
    newEntry > 0
      ? trade.side === 'SHORT'
        ? newEntry - net
        : newEntry + net
      : null

  const totalNet = net * trade.quantity * mult
  const newProjectedProfit = newEntry > 0 ? newEntry * trade.quantity * mult : null

  // Break-even analysis after roll (SHORT options):
  //   Total P&L/contract = original_entry + net_credit − Z
  //   To preserve original premium: Z ≤ net_credit
  //   To break even on full series:  Z ≤ original_entry + net_credit
  const bePreserve = net                              // close ≤ this to keep original premium
  const beFullSeries = trade.entryPrice + net          // close ≤ this to break even on all legs

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const fd = new FormData()
    fd.set('netCredit', netCredit)
    fd.set('rollDate', rollDate)
    fd.set('newEntryPrice', newEntryPrice)
    if (newStrike) fd.set('newStrike', newStrike)
    if (newExpiration) fd.set('newExpiration', newExpiration)
    try {
      await rollTrade(trade.id, fd)
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to roll trade')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Roll {trade.ticker} {trade.optionType ?? ''}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Current position info */}
          <div className="rounded-md bg-muted/50 border px-3 py-2 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Position</span>
              <span className="font-mono">{trade.symbol}</span>
            </div>
            {trade.strike != null && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Strike</span>
                <span className="font-mono">${trade.strike}</span>
              </div>
            )}
            {trade.expiration && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Expires</span>
                <span className="font-mono">{new Date(trade.expiration).toLocaleDateString()}</span>
              </div>
            )}
            <div className="flex justify-between border-t pt-1 mt-1">
              <span className="text-muted-foreground">Premium collected (this leg)</span>
              <span className="font-mono">${trade.entryPrice.toFixed(2)} · ${totalPremium.toFixed(2)}</span>
            </div>
          </div>

          {/* Roll inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Net credit (+) / debit (−)</Label>
              <Input
                type="number"
                step="any"
                placeholder="e.g. 3.2 or -0.5"
                value={netCredit}
                onChange={(e) => setNetCredit(e.target.value)}
                required
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label>Roll date</Label>
              <DatePicker name="rollDate" value={rollDate} onValueChange={setRollDate} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>New strike</Label>
              <Input
                type="number"
                step="any"
                value={newStrike}
                onChange={(e) => setNewStrike(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>New expiration</Label>
              <DatePicker name="newExpiration" value={newExpiration} onValueChange={setNewExpiration} />
            </div>
            <div className="space-y-1">
              <Label>New avg</Label>
              <Input
                type="number"
                step="any"
                placeholder="0.00"
                value={newEntryPrice}
                onChange={(e) => setNewEntryPrice(e.target.value)}
                required
              />
            </div>
          </div>

          {/* Live summary */}
          {netCredit !== '' && newEntry > 0 && (
            <div className="rounded-md border px-3 py-2 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Net on roll</span>
                <span className={`font-mono font-medium ${totalNet >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {totalNet >= 0 ? '+' : ''}${totalNet.toFixed(2)}
                </span>
              </div>
              {derivedExitPrice !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Implied buy-back</span>
                  <span className="font-mono">${derivedExitPrice.toFixed(2)}</span>
                </div>
              )}
              {newProjectedProfit !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">New leg proj. profit</span>
                  <span className="font-mono">${newProjectedProfit.toFixed(2)}</span>
                </div>
              )}
              <div className="border-t pt-1 mt-1 space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BE — preserve ${trade.entryPrice.toFixed(2)}</span>
                  <span className="font-mono font-medium">≤${bePreserve.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">BE — full series</span>
                  <span className="font-mono font-medium">≤${beFullSeries.toFixed(2)}</span>
                </div>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Rolling…' : 'Roll Trade'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
