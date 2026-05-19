# Cash Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `CashActivity` table to record non-trade cash movements per account, import them from TradeStation's CSV format, and include them in the account current balance.

**Architecture:** A new `CashActivity` Prisma model uses a deterministic SHA-256 hash as its primary key for built-in deduplication. A pure parser function handles TradeStation CSV → typed records; a server action upserts them and supports batch revert. The accounts page passes activities as props to the client table component, which gains "Import movements" and "View movements" dialogs.

**Tech Stack:** Next.js 16 App Router, Prisma v7, Supabase auth, shadcn/ui (Dialog, Badge, Button), Node.js `crypto` (SHA-256)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `CashActivityType` enum + `CashActivity` model + Account relation |
| `prisma/migrations/…` | Create | DB migration for new table |
| `src/lib/parse-cash-activity.ts` | Create | Pure CSV parser + description classifier (browser-safe) |
| `src/actions/cash-activity.ts` | Create | `importCashActivity`, `revertCashImport` server actions |
| `src/app/(app)/accounts/page.tsx` | Modify | Include cash activities in balance + pass to table |
| `src/components/accounts-table.tsx` | Modify | Add Import and View movements dialogs |

---

## Task 1: Prisma schema — CashActivity model

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enum and model to schema**

Open `prisma/schema.prisma`. After the existing `TradeSource` enum, add:

```prisma
enum CashActivityType {
  MARGIN_INTEREST
  INTEREST
  DIVIDEND
  TAX
  DEPOSIT
  WITHDRAWAL
  OTHER
}
```

After the `MonthlySnapshot` model, add:

```prisma
model CashActivity {
  id            String           @id
  userId        String           @db.Uuid         @map("user_id")
  accountId     String           @db.Uuid         @map("account_id")
  date          DateTime         @db.Date
  description   String
  type          CashActivityType
  amount        Decimal          @db.Decimal(18, 2)
  currency      String           @default("USD")
  importBatchId String           @db.Uuid         @map("import_batch_id")
  createdAt     DateTime         @default(now())  @map("created_at")
  account       Account          @relation(fields: [accountId], references: [id])
  @@map("cash_activities")
}
```

Also add the relation to the `Account` model — inside the `Account` model block, after `monthlySnapshots MonthlySnapshot[]`:

```prisma
cashActivities   CashActivity[]
```

- [ ] **Step 2: Run migration**

```bash
npx prisma migrate dev --name add_cash_activity
```

Expected output: `The following migration(s) have been created and applied … add_cash_activity`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `Generated Prisma Client` message with no errors.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add CashActivity schema model"
```

---

## Task 2: CSV parser

**Files:**
- Create: `src/lib/parse-cash-activity.ts`

- [ ] **Step 1: Create the file**

```ts
// src/lib/parse-cash-activity.ts

export type CashActivityType =
  | 'MARGIN_INTEREST'
  | 'INTEREST'
  | 'DIVIDEND'
  | 'TAX'
  | 'DEPOSIT'
  | 'WITHDRAWAL'
  | 'OTHER'

export type CashActivityRecord = {
  date: string        // YYYY-MM-DD
  description: string // trimmed raw description
  type: CashActivityType
  amount: number      // negative = outflow
  currency: string
}

function classifyDescription(desc: string): CashActivityType {
  if (/%/.test(desc) && /\d{2}\/\d{2}-\d{2}\/\d{2}/.test(desc)) return 'MARGIN_INTEREST'
  if (/FPL Revenue|FPL INTEREST CR/i.test(desc)) return 'INTEREST'
  if (/NRA WITHHOLD: DIVIDEND/i.test(desc)) return 'TAX'
  if (/NRA WITHHOLDING/i.test(desc)) return 'TAX'
  if (/DEPOSIT/i.test(desc)) return 'DEPOSIT'
  if (/WITHDRAWAL|DISBURSEMENT/i.test(desc)) return 'WITHDRAWAL'
  if (/^[A-Z][A-Z\s]+\s+\d+\s*$/.test(desc)) return 'DIVIDEND'
  return 'OTHER'
}

function parseDate(raw: string): string {
  const [month, day, year] = raw.split('/')
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

function parseAmount(raw: string): number {
  return parseFloat(raw.replace(/[$,]/g, ''))
}

function parseCsvLine(line: string): string[] {
  // All fields in TradeStation cash activity CSVs are double-quoted
  return line.replace(/^"|"$/g, '').split('","')
}

export function parseCashActivityCsv(text: string): CashActivityRecord[] {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  // Find the data header row
  const headerIdx = lines.findIndex(l => l.includes('"Date"'))
  if (headerIdx === -1) return []

  const records: CashActivityRecord[] = []

  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i]
    if (!line.startsWith('"')) continue

    const fields = parseCsvLine(line)
    if (fields.length < 4) continue

    const [rawDate, rawDesc, rawAmount, rawCurrency] = fields
    const description = rawDesc.trim()

    records.push({
      date: parseDate(rawDate),
      description,
      type: classifyDescription(description),
      amount: parseAmount(rawAmount),
      currency: rawCurrency.trim(),
    })
  }

  return records
}
```

- [ ] **Step 2: Verify it parses the sample file correctly**

Start a temporary Node script (or run in the dev server console) to spot-check. The CSV at `data/cash_activity_11927184_01JAN2026_18MAY2026.csv` should produce these records when parsed:

| date | description (trimmed) | type | amount |
|---|---|---|---|
| 2026-01-30 | `11.75000%01/01-01/30    $3567` | `MARGIN_INTEREST` | -34.44 |
| 2026-02-03 | `FPL Revenue` | `INTEREST` | 0.35 |
| 2026-02-03 | `FPL INTEREST CR` | `INTEREST` | 0.35 |
| 2026-02-03 | `NRA WITHHOLDING` | `TAX` | 0.00 |
| 2026-03-31 | `ULTRA SEMICONDU            500` | `DIVIDEND` | 29.37 |
| 2026-03-31 | `NRA WITHHOLD: DIVIDEND` | `TAX` | -8.81 |

- [ ] **Step 3: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/parse-cash-activity.ts
git commit -m "feat: add TradeStation cash activity CSV parser"
```

---

## Task 3: Server actions

**Files:**
- Create: `src/actions/cash-activity.ts`

- [ ] **Step 1: Create the file**

```ts
// src/actions/cash-activity.ts
'use server'

import { createHash, randomUUID } from 'crypto'
import { revalidatePath } from 'next/cache'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'
import type { CashActivityRecord } from '@/lib/parse-cash-activity'

export type ImportCashResult = {
  imported: number
  skipped: number
  batchId: string
}

function hashCashActivityId(
  accountId: string,
  date: string,
  description: string,
  amount: number,
  currency: string,
): string {
  return createHash('sha256')
    .update(`${accountId}|${date}|${description}|${amount}|${currency}`)
    .digest('hex')
}

function revalidateAccounts(): void {
  revalidatePath('/accounts')
  revalidatePath('/dashboard')
}

export async function importCashActivity(
  accountId: string,
  records: CashActivityRecord[],
): Promise<ImportCashResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  const account = await prisma.account.findFirst({ where: { id: accountId, userId } })
  if (!account) throw new Error('Account not found')

  const batchId = randomUUID()

  const rows = records.map(r => ({
    id: hashCashActivityId(accountId, r.date, r.description, r.amount, r.currency),
    userId,
    accountId,
    date: new Date(r.date),
    description: r.description,
    type: r.type,
    amount: r.amount,
    currency: r.currency,
    importBatchId: batchId,
  }))

  const result = await prisma.cashActivity.createMany({
    data: rows,
    skipDuplicates: true,
  })

  revalidateAccounts()

  return {
    imported: result.count,
    skipped: records.length - result.count,
    batchId,
  }
}

export async function revertCashImport(batchId: string): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const userId = user.id

  const owned = await prisma.cashActivity.findFirst({ where: { userId, importBatchId: batchId } })
  if (!owned) throw new Error('Import batch not found')

  await prisma.cashActivity.deleteMany({ where: { userId, importBatchId: batchId } })

  revalidateAccounts()
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/actions/cash-activity.ts
git commit -m "feat: add importCashActivity and revertCashImport server actions"
```

---

## Task 4: Update accounts page — balance includes cash activity

**Files:**
- Modify: `src/app/(app)/accounts/page.tsx`

- [ ] **Step 1: Update the page query and balance calculation**

Replace the entire file content with:

```tsx
import { createClient } from '@/lib/supabase/server'
import { prisma } from '@/lib/prisma'
import { AccountsTable } from '@/components/accounts-table'

export default async function AccountsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const accounts = await prisma.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'asc' },
    include: {
      cashActivities: { orderBy: { date: 'desc' } },
    },
  })

  const accountsWithBalance = await Promise.all(
    accounts.map(async (account) => {
      const result = await prisma.trade.aggregate({
        where: { accountId: account.id, userId: user.id, closeDate: { not: null } },
        _sum: { netPnl: true },
      })
      const netPnl = Number(result._sum.netPnl ?? 0)
      const cashSum = account.cashActivities.reduce((sum, a) => sum + Number(a.amount), 0)
      return {
        id: account.id,
        userId: account.userId,
        name: account.name,
        broker: account.broker,
        description: account.description,
        isActive: account.isActive,
        isMain: account.isMain,
        startingBalance: Number(account.startingBalance),
        commissionPerOption: Number(account.commissionPerOption),
        commissionPerStock: Number(account.commissionPerStock),
        optionAssignmentFee: Number(account.optionAssignmentFee),
        createdAt: account.createdAt,
        currentBalance: Number(account.startingBalance) + netPnl + cashSum,
        cashActivities: account.cashActivities.map(a => ({
          id: a.id,
          date: a.date.toISOString().slice(0, 10),
          description: a.description,
          type: a.type as string,
          amount: Number(a.amount),
          currency: a.currency,
          importBatchId: a.importBatchId,
        })),
      }
    })
  )

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Accounts</h1>
      </div>
      <AccountsTable accounts={accountsWithBalance} />
    </div>
  )
}
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/accounts/page.tsx
git commit -m "feat: include cash activity in account current balance"
```

---

## Task 5: AccountsTable — Import and View movements dialogs

**Files:**
- Modify: `src/components/accounts-table.tsx`

- [ ] **Step 1: Replace file with updated version including both new dialogs**

Replace the entire file with:

```tsx
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
```

- [ ] **Step 2: Type-check**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Start dev server and manually test**

```bash
npm run dev
```

Open `http://localhost:3000/accounts`. For each account row verify:
1. Two new buttons appear: "Import movements" and "View movements"
2. Click "Import movements" → file picker dialog opens
3. Select `data/cash_activity_11927184_01JAN2026_18MAY2026.csv` → click Import
4. Result message shows e.g. "Imported 15 movements."
5. Account current balance updates to reflect cash activity sum
6. Click "View movements" → dialog shows all movements grouped under one batch, with colored amounts and type badges
7. Click "Revert import" → movements disappear from view and balance reverts
8. Re-import the same file → result shows "0 imported, 15 duplicates skipped"

- [ ] **Step 4: Commit**

```bash
git add src/components/accounts-table.tsx
git commit -m "feat: add Import and View movements dialogs to accounts table"
```
