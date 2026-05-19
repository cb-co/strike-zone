'use client'

import { useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createAccount, updateAccount, deleteAccount, setMainAccount } from '@/actions/accounts'
import { importCashActivity, revertCashImport } from '@/actions/cash-activity'
import { parseCashActivityCsv } from '@/lib/parse-cash-activity'
import { DeleteAllTradesButton } from '@/components/delete-all-trades-button'

type CashActivityEntry = {
  id: string
  date: string
  description: string
  type: string
  amount: number
  currency: string
  importBatchId: string
}

type Account = {
  id: string
  name: string
  broker: string
  description: string | null
  isActive: boolean
  isMain: boolean
  startingBalance: number
  currentBalance: number
  commissionPerOption: number
  commissionPerStock: number
  optionAssignmentFee: number
  cashActivities: CashActivityEntry[]
}

function AccountForm({ account, onDone }: { account?: Account; onDone: () => void }) {
  const action = account
    ? (fd: FormData) => updateAccount(account.id, fd).then(onDone)
    : (fd: FormData) => createAccount(fd).then(onDone)

  return (
    <form action={action} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="name">Name</Label>
          <Input id="name" name="name" defaultValue={account?.name} required />
        </div>
        <div className="space-y-1">
          <Label htmlFor="broker">Broker</Label>
          <Input id="broker" name="broker" defaultValue={account?.broker} required />
        </div>
      </div>
      <div className="space-y-1">
        <Label htmlFor="description">Description</Label>
        <Input id="description" name="description" defaultValue={account?.description ?? ''} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="startingBalance">Starting Balance ($)</Label>
          <Input id="startingBalance" name="startingBalance" type="number" step="0.01" defaultValue={String(account?.startingBalance ?? 0)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="commissionPerOption">Commission / Option ($)</Label>
          <Input id="commissionPerOption" name="commissionPerOption" type="number" step="0.01" defaultValue={String(account?.commissionPerOption ?? 0)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <Label htmlFor="commissionPerStock">Commission / Stock ($)</Label>
          <Input id="commissionPerStock" name="commissionPerStock" type="number" step="0.01" defaultValue={String(account?.commissionPerStock ?? 0)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="optionAssignmentFee">Option Assignment Fee ($)</Label>
          <Input id="optionAssignmentFee" name="optionAssignmentFee" type="number" step="0.01" defaultValue={String(account?.optionAssignmentFee ?? 0)} />
        </div>
      </div>
      <div className="flex items-center gap-6">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="isMain" value="true" defaultChecked={account?.isMain} className="rounded" />
          Set as main account
        </label>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" name="isActive" value="true" defaultChecked={account?.isActive ?? true} className="rounded" />
          Active
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onDone}>Cancel</Button>
        <Button type="submit">{account ? 'Save' : 'Create'}</Button>
      </div>
    </form>
  )
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  MARGIN_INTEREST: 'Margin Int.',
  INTEREST: 'Interest',
  DIVIDEND: 'Dividend',
  TAX: 'Tax',
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  OTHER: 'Other',
}

type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

const ACTIVITY_TYPE_VARIANT: Record<string, BadgeVariant> = {
  MARGIN_INTEREST: 'outline',
  INTEREST: 'secondary',
  DIVIDEND: 'secondary',
  TAX: 'destructive',
  DEPOSIT: 'default',
  WITHDRAWAL: 'destructive',
  OTHER: 'outline',
}

function groupByBatch(activities: CashActivityEntry[]) {
  const groups = new Map<string, CashActivityEntry[]>()
  for (const a of activities) {
    const group = groups.get(a.importBatchId) ?? []
    group.push(a)
    groups.set(a.importBatchId, group)
  }
  return [...groups.entries()].map(([batchId, items]) => ({ batchId, items }))
}

function ImportMovementsDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (!file) return

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const text = await file.text()
      const records = parseCashActivityCsv(text)
      if (records.length === 0) {
        setError('No records found. Make sure this is a TradeStation Cash Activity CSV.')
        return
      }
      const res = await importCashActivity(account.id, records)
      setResult({ imported: res.imported, skipped: res.skipped })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed')
    } finally {
      setLoading(false)
    }
  }

  function handleOpenChange(o: boolean) {
    setOpen(o)
    if (!o) {
      setResult(null)
      setError(null)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">Import movements</Button>
      </DialogTrigger>
      <DialogContent aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Import cash movements — {account.name}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="csv-file">TradeStation Cash Activity CSV</Label>
            <Input id="csv-file" ref={fileRef} type="file" accept=".csv" required />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          {result && (
            <p className="text-sm text-muted-foreground">
              Imported {result.imported} movement{result.imported !== 1 ? 's' : ''}.
              {result.skipped > 0 ? ` ${result.skipped} duplicate${result.skipped !== 1 ? 's' : ''} skipped.` : ''}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              {result ? 'Close' : 'Cancel'}
            </Button>
            {!result && (
              <Button type="submit" disabled={loading}>
                {loading ? 'Importing…' : 'Import'}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function ViewMovementsDialog({ account }: { account: Account }) {
  const [open, setOpen] = useState(false)
  const [revertingBatchId, setRevertingBatchId] = useState<string | null>(null)

  const batches = groupByBatch(account.cashActivities)

  async function handleRevert(batchId: string) {
    setRevertingBatchId(batchId)
    try {
      await revertCashImport(batchId)
    } finally {
      setRevertingBatchId(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">View movements</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Cash movements — {account.name}</DialogTitle>
        </DialogHeader>
        {account.cashActivities.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No cash movements imported yet.
          </p>
        ) : (
          <div className="max-h-[60vh] overflow-y-auto space-y-6">
            {batches.map(({ batchId, items }) => (
              <div key={batchId} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-mono">
                    Batch {batchId.slice(0, 8)}… ({items.length} row{items.length !== 1 ? 's' : ''})
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive hover:text-destructive h-6 text-xs"
                    disabled={revertingBatchId === batchId}
                    onClick={() => handleRevert(batchId)}
                  >
                    {revertingBatchId === batchId ? 'Reverting…' : 'Revert import'}
                  </Button>
                </div>
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/50">
                    <tr>
                      <th className="px-2 py-1 text-left font-medium">Date</th>
                      <th className="px-2 py-1 text-left font-medium">Type</th>
                      <th className="px-2 py-1 text-left font-medium">Description</th>
                      <th className="px-2 py-1 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {items.map((a) => (
                      <tr key={a.id}>
                        <td className="px-2 py-1 text-muted-foreground whitespace-nowrap">{a.date}</td>
                        <td className="px-2 py-1">
                          <Badge variant={ACTIVITY_TYPE_VARIANT[a.type] ?? 'outline'}>
                            {ACTIVITY_TYPE_LABELS[a.type] ?? a.type}
                          </Badge>
                        </td>
                        <td className="px-2 py-1 text-muted-foreground max-w-[200px] truncate" title={a.description}>
                          {a.description}
                        </td>
                        <td className={`px-2 py-1 text-right font-mono ${a.amount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {a.amount >= 0 ? '+' : ''}
                          {a.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

export function AccountsTable({ accounts }: { accounts: Account[] }) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button>Add Account</Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined}>
            <DialogHeader><DialogTitle>New Account</DialogTitle></DialogHeader>
            <AccountForm onDone={() => setAddOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Broker</th>
              <th className="px-4 py-3 text-right font-medium">Starting</th>
              <th className="px-4 py-3 text-right font-medium">Current</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {accounts.map((account) => (
              <tr key={account.id}>
                <td className="px-4 py-3 font-medium">{account.name}</td>
                <td className="px-4 py-3 text-muted-foreground">{account.broker}</td>
                <td className="px-4 py-3 text-right">${Number(account.startingBalance).toLocaleString()}</td>
                <td className="px-4 py-3 text-right font-mono">
                  ${account.currentBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {account.isMain && <Badge variant="default">Main</Badge>}
                    {account.isActive && <Badge variant="secondary">Active</Badge>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex justify-end gap-2 flex-wrap">
                    {!account.isMain && (
                      <Button size="sm" variant="outline" onClick={() => setMainAccount(account.id)}>
                        Set Main
                      </Button>
                    )}
                    <ImportMovementsDialog account={account} />
                    <ViewMovementsDialog account={account} />
                    <Dialog open={editingId === account.id} onOpenChange={(o) => setEditingId(o ? account.id : null)}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline">Edit</Button>
                      </DialogTrigger>
                      <DialogContent aria-describedby={undefined}>
                        <DialogHeader><DialogTitle>Edit Account</DialogTitle></DialogHeader>
                        <AccountForm account={account} onDone={() => setEditingId(null)} />
                      </DialogContent>
                    </Dialog>
                    <DeleteAllTradesButton accountId={account.id} accountName={account.name} />
                    <Button size="sm" variant="destructive" onClick={() => deleteAccount(account.id)}>
                      Delete
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No accounts yet</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
