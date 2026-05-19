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
