'use client'

import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { createTrade, updateTrade } from '@/actions/trades'

type Account = { id: string; name: string }
type Setup = { id: string; name: string }

export type TradeFormTrade = {
  id: string
  name: string
  ticker: string
  symbol: string
  side: 'LONG' | 'SHORT'
  quantity: number | string
  entryPrice: number | string
  openDate: Date | string
  accountId: string
  notes: string | null
  projectedProfit: number | string | null
  optionType: 'CALL' | 'PUT' | null
  strike: number | string | null
  expiration: Date | string | null
  contractSize: number | null
  exitPrice: number | string | null
  closeDate: Date | string | null
  tradeSetups?: { setupId: string }[]
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  accounts: Account[]
  setups: Setup[]
  trade?: TradeFormTrade
}

function toDateInput(val: Date | string | null | undefined): string {
  if (!val) return ''
  const d = val instanceof Date ? val : new Date(val)
  return d.toISOString().split('T')[0]
}

function today(): string {
  return new Date().toISOString().split('T')[0]
}

type ParsedOption = { optionType: 'CALL' | 'PUT'; strike: string; expiration: string } | null

function parseOccSymbol(symbol: string): ParsedOption {
  // OCC format: [TICKER][YYMMDD][C|P][8-digit strike]
  // e.g. SOXL250417P00012000
  const m = symbol.trim().toUpperCase().match(/^[A-Z0-9]{1,6}(\d{2})(\d{2})(\d{2})([CP])(\d{5})(\d{3})$/)
  if (!m) return null
  const [, yy, mm, dd, cp, whole, frac] = m
  const expiration = `20${yy}-${mm}-${dd}`
  const strike = `${parseInt(whole, 10)}.${frac}`
  return { optionType: cp === 'C' ? 'CALL' : 'PUT', strike, expiration }
}

export function TradeForm({ open, onOpenChange, accounts, setups, trade }: Props) {
  const [isOption, setIsOption] = useState(!!trade?.optionType)
  const [inferredOption, setInferredOption] = useState<ParsedOption>(
    trade?.symbol ? parseOccSymbol(trade.symbol) : null
  )
  const [side, setSide] = useState<string>(trade?.side ?? 'LONG')
  const [optionType, setOptionType] = useState<string>(trade?.optionType ?? 'CALL')
  const [strike, setStrike] = useState<string>(String(trade?.strike ?? ''))
  const [expiration, setExpiration] = useState<string>(toDateInput(trade?.expiration))
  const [selectedSetups, setSelectedSetups] = useState<Set<string>>(
    new Set(trade?.tradeSetups?.map((ts) => ts.setupId) ?? [])
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [entryPrice, setEntryPrice] = useState<string>(String(trade?.entryPrice ?? ''))
  const [quantity, setQuantity] = useState<string>(String(trade?.quantity ?? ''))
  const [contractSize, setContractSize] = useState<string>(String(trade?.contractSize ?? 100))

  const isEditing = !!trade
  const isOpen = !trade?.closeDate
  const showOptionFields = isOption || !!inferredOption

  const projectedProfit =
    showOptionFields && side === 'SHORT'
      ? (parseFloat(entryPrice) || 0) * (parseFloat(quantity) || 0) * (parseFloat(contractSize) || 100)
      : null

  function handleSymbolChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    const parsed = parseOccSymbol(val)
    setInferredOption(parsed)
    if (parsed) {
      setOptionType(parsed.optionType)
      setStrike(parsed.strike)
      setExpiration(parsed.expiration)
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const fd = new FormData(e.currentTarget)
    fd.set('side', side)

    if (showOptionFields) {
      fd.set('optionType', optionType)
      fd.set('strike', strike)
      fd.set('expiration', expiration)
    } else {
      fd.delete('optionType')
      fd.delete('strike')
      fd.delete('expiration')
      fd.delete('contractSize')
    }

    fd.set('setupIds', JSON.stringify([...selectedSetups]))

    if (projectedProfit !== null) {
      fd.set('projectedProfit', String(projectedProfit))
    } else {
      fd.delete('projectedProfit')
    }

    try {
      if (isEditing) {
        await updateTrade(trade.id, fd)
      } else {
        await createTrade(fd)
      }
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  function toggleSetup(setupId: string) {
    setSelectedSetups((prev) => {
      const next = new Set(prev)
      if (next.has(setupId)) next.delete(setupId)
      else next.add(setupId)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Trade' : 'Add Trade'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Account */}
          <div className="space-y-1">
            <Label htmlFor="accountId">Account</Label>
            <Select name="accountId" defaultValue={trade?.accountId ?? accounts[0]?.id}>
              <SelectTrigger id="accountId"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">Trade Name</Label>
            <Input id="name" name="name" defaultValue={trade?.name} placeholder="e.g. SOXL Buy Dip" required />
          </div>

          {/* Ticker + Symbol */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="ticker">Ticker</Label>
              <Input id="ticker" name="ticker" defaultValue={trade?.ticker} placeholder="SOXL" required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="symbol">
                Symbol
                {inferredOption && (
                  <span className="ml-2 text-xs text-muted-foreground font-normal">option detected</span>
                )}
              </Label>
              <Input
                id="symbol"
                name="symbol"
                defaultValue={trade?.symbol}
                placeholder="SOXL or SOXL250417P00012000"
                onChange={handleSymbolChange}
                required
              />
            </div>
          </div>

          {/* Side */}
          <div className="space-y-1">
            <Label>Side</Label>
            <Select value={side} onValueChange={setSide}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="LONG">Long</SelectItem>
                <SelectItem value="SHORT">Short</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Qty + Entry + Open Date */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label htmlFor="quantity">Qty</Label>
              <Input id="quantity" name="quantity" type="number" step="any" value={quantity} onChange={(e) => setQuantity(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="entryPrice">Entry Price</Label>
              <Input id="entryPrice" name="entryPrice" type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label htmlFor="openDate">Open Date</Label>
              <Input id="openDate" name="openDate" type="date" defaultValue={toDateInput(trade?.openDate) || today()} required />
            </div>
          </div>

          {/* Option toggle — only shown when not auto-detected */}
          {!inferredOption && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="isOption"
                checked={isOption}
                onCheckedChange={(v: boolean | 'indeterminate') => setIsOption(!!v)}
              />
              <Label htmlFor="isOption" className="cursor-pointer">This is an option trade</Label>
            </div>
          )}

          {/* Option fields */}
          {showOptionFields && (
            <div className="rounded-md border p-3 space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label>Type</Label>
                  <Select value={optionType} onValueChange={setOptionType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CALL">Call</SelectItem>
                      <SelectItem value="PUT">Put</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="strike">Strike</Label>
                  <Input id="strike" name="strike" type="number" step="any" value={strike} onChange={(e) => setStrike(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="contractSize">Contracts</Label>
                  <Input id="contractSize" name="contractSize" type="number" value={contractSize} onChange={(e) => setContractSize(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="expiration">Expiration</Label>
                <Input id="expiration" name="expiration" type="date" value={expiration} onChange={(e) => setExpiration(e.target.value)} />
              </div>
            </div>
          )}

          {projectedProfit !== null && (
            <div className="rounded-md border bg-muted/50 px-3 py-2 flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Projected profit (premium collected)</span>
              <span className="font-mono font-medium">
                ${projectedProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          )}

          <div className="space-y-1">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" name="notes" defaultValue={trade?.notes ?? ''} rows={4} />
          </div>

          {/* Close fields — only when editing an open trade */}
          {isEditing && isOpen && (
            <div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/20 p-3 space-y-3">
              <p className="text-sm font-medium text-orange-800 dark:text-orange-300">Close trade</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="exitPrice">Exit Price</Label>
                  <Input id="exitPrice" name="exitPrice" type="number" step="any" defaultValue={String(trade?.exitPrice ?? '')} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="closeDate">Close Date</Label>
                  <Input id="closeDate" name="closeDate" type="date" defaultValue={toDateInput(trade?.closeDate)} />
                </div>
              </div>
            </div>
          )}

          {/* Setups */}
          {setups.length > 0 && (
            <div className="space-y-2">
              <Label>Setups</Label>
              <div className="flex flex-wrap gap-2">
                {setups.map((setup) => (
                  <label key={setup.id} className="flex items-center gap-1.5 cursor-pointer">
                    <Checkbox
                      checked={selectedSetups.has(setup.id)}
                      onCheckedChange={() => toggleSetup(setup.id)}
                    />
                    <span className="text-sm">{setup.name}</span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving…' : isEditing ? 'Save' : 'Add Trade'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
