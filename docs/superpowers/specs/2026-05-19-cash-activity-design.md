# Cash Activity — Design Spec

**Date:** 2026-05-19  
**Status:** Approved

## Overview

Add a `CashActivity` table to record non-trade cash movements (interest, dividends, taxes, deposits, withdrawals) against an account. Provide a CSV import flow for TradeStation's "Cash Activity" report format and include those movements in the account's current balance.

---

## Data Model

### New enum: `CashActivityType`

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

### New model: `CashActivity`

```prisma
model CashActivity {
  id            String           @id              // deterministic SHA-256 hash (see Duplicate Detection)
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

`Account` gains: `cashActivities CashActivity[]`

### Balance formula update

```
currentBalance = startingBalance + sum(trade.netPnl where closeDate != null) + sum(cashActivity.amount)
```

Applied in `src/app/(app)/accounts/page.tsx` (the existing `accountsWithBalance` query).

---

## Duplicate Detection

Each row's `id` is a **deterministic SHA-256 hash** of:

```
accountId + date (YYYY-MM-DD) + description (trimmed) + amount (string) + currency
```

Formatted as a lowercase hex string truncated/padded to 32 hex chars and inserted as a Prisma `String @id`. On re-import of the same CSV, `upsert` with `update: {}` silently skips existing rows. The `importBatchId` is set only on newly created rows, so reverting a batch only removes rows from that specific import run.

---

## CSV Parser

**File:** `src/lib/parse-cash-activity.ts`

### Format

TradeStation "Cash Activity" CSV:
- 8-line metadata header (lines starting with `#` or blank or non-data)
- Data rows after the blank line following the header block
- Columns: `"Date","Description","Amount","Currency"`
- Amount uses `$` prefix, negative values use `-$` (e.g. `"-$34.44"`)

### Parsing steps

1. Skip lines until the header row `"Date","Description","Amount","Currency"` is found.
2. Parse each subsequent non-empty row.
3. Strip `$`, `,` from amount; handle `-$` as negative.
4. Trim description whitespace.
5. Classify description into `CashActivityType` (see below).

### Classification rules (applied in order)

| Condition | Type |
|---|---|
| Description contains `%` and a date-range pattern (e.g. `01/01-01/30`) | `MARGIN_INTEREST` |
| Description matches `FPL Revenue` or `FPL INTEREST CR` (case-insensitive) | `INTEREST` |
| Description contains `NRA WITHHOLD: DIVIDEND` (case-insensitive) | `TAX` |
| Description contains `NRA WITHHOLDING` (case-insensitive) | `TAX` |
| Description contains `DEPOSIT` (case-insensitive) | `DEPOSIT` |
| Description contains `WITHDRAWAL` or `DISBURSEMENT` (case-insensitive) | `WITHDRAWAL` |
| Description matches `/^[A-Z][A-Z\s]+\s+\d+\s*$/` (all-caps name + trailing number — stock dividend) | `DIVIDEND` |
| Anything else | `OTHER` |

### Return type

```ts
export type CashActivityRecord = {
  date: string           // YYYY-MM-DD
  description: string    // trimmed raw description
  type: CashActivityType
  amount: number         // negative = outflow
  currency: string
}
```

---

## Server Actions

**File:** `src/actions/cash-activity.ts`

### `importCashActivity(accountId: string, records: CashActivityRecord[]): Promise<ImportCashResult>`

- Authenticates user, verifies account ownership.
- Generates `importBatchId = randomUUID()`.
- For each record, computes deterministic `id` hash.
- Batch `upsert` via Prisma: `create` the row, `update: {}` (no-op on conflict).
- Returns `{ imported: number, skipped: number, batchId: string }`.
- Calls `revalidatePath('/accounts')`.

### `revertCashImport(batchId: string): Promise<void>`

- Authenticates user, verifies batch belongs to user.
- `deleteMany` where `{ userId, importBatchId: batchId }`.
- Calls `revalidatePath('/accounts')`.

---

## UI

### Accounts table — two new action buttons per row

Both buttons are added to the actions cell in `src/components/accounts-table.tsx`.

#### "Import movements" button

- Opens a Dialog.
- Contains a file input (`accept=".csv"`).
- On submit: reads file as text in client, calls `parseCashActivityCsv(text)` (client-safe pure function), then calls `importCashActivity(accountId, records)` server action.
- Shows result: `"Imported N movements (N duplicates skipped)"` or error.

#### "View movements" button

- Opens a Dialog with a scrollable table.
- Fetches cash activities for the account (passed as prop from server component, or via a server action).
- Table columns: Date | Type (badge) | Description | Amount (green if positive, red if negative).
- Groups rows by `importBatchId`; each group has a "Revert import" button that calls `revertCashImport(batchId)`.

### Badge colors for type

| Type | Variant |
|---|---|
| INTEREST, DIVIDEND | `secondary` (green-ish) |
| MARGIN_INTEREST | `outline` |
| TAX | `destructive` |
| DEPOSIT | `default` |
| WITHDRAWAL | `destructive` |
| OTHER | `outline` |

---

## Files Changed / Created

| File | Change |
|---|---|
| `prisma/schema.prisma` | Add `CashActivityType` enum, `CashActivity` model, relation on `Account` |
| `prisma/migrations/…` | New migration |
| `src/lib/parse-cash-activity.ts` | CSV parser + classifier (pure, no DB) |
| `src/actions/cash-activity.ts` | `importCashActivity`, `revertCashImport` |
| `src/components/accounts-table.tsx` | Add "Import movements" and "View movements" dialogs |
| `src/app/(app)/accounts/page.tsx` | Include cash activity sum in balance; pass activities to table |

---

## Out of Scope

- Manual entry of individual cash activity rows (import-only for now).
- Editing or re-categorizing imported rows.
- Support for non-TradeStation CSV formats.
- Filtering/searching the movements view.
