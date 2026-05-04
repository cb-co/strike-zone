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

const goalSchema = z.object({
  accountId: z.string().uuid(),
  year: z.coerce.number().int().min(2020).max(2100),
  goalAmount: z.coerce.number().positive(),
  curveFactor: z.coerce.number().positive(),
  monthlyFixedWd: z.coerce.number().default(0),
  monthlyVariableWdPct: z.coerce.number().min(0).max(1).default(0),
})

export async function createGoal(formData: FormData) {
  const userId = await getUserId()
  const data = goalSchema.parse(Object.fromEntries(formData))
  await prisma.goal.create({ data: { ...data, userId } })
  revalidatePath('/goals', 'page')
  revalidatePath('/monthly', 'page')
  revalidatePath('/dashboard', 'page')
}

export async function updateGoal(id: string, formData: FormData) {
  const userId = await getUserId()
  const data = goalSchema.parse(Object.fromEntries(formData))
  await prisma.goal.update({ where: { id, userId }, data })
  revalidatePath('/goals', 'page')
  revalidatePath('/monthly', 'page')
  revalidatePath('/dashboard', 'page')
}

export async function deleteGoal(id: string) {
  const userId = await getUserId()
  await prisma.goal.delete({ where: { id, userId } })
  revalidatePath('/goals', 'page')
  revalidatePath('/monthly', 'page')
  revalidatePath('/dashboard', 'page')
}
