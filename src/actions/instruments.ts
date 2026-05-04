'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { createClient } from '@/lib/supabase/server'

async function getUserId() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  return user.id
}

const instrumentSchema = z.object({
  ticker: z.string().min(1).toUpperCase(),
  name: z.string().min(1),
  type: z.enum(['ETF', 'STOCK', 'CRYPTO']),
  description: z.string().optional(),
})

export async function createInstrument(formData: FormData) {
  const userId = await getUserId()
  const data = instrumentSchema.parse(Object.fromEntries(formData))
  await prisma.instrument.create({ data: { ...data, userId } })
  revalidatePath('/instruments', 'page')
}

export async function updateInstrument(id: string, formData: FormData) {
  const userId = await getUserId()
  const data = instrumentSchema.parse(Object.fromEntries(formData))
  await prisma.instrument.update({ where: { id, userId }, data })
  revalidatePath('/instruments', 'page')
}

export async function deleteInstrument(id: string) {
  const userId = await getUserId()
  await prisma.instrument.delete({ where: { id, userId } })
  revalidatePath('/instruments', 'page')
}
