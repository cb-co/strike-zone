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

const accountSchema = z.object({
  name: z.string().min(1),
  broker: z.string().min(1),
  description: z.string().optional(),
  startingBalance: z.coerce.number().default(0),
  commissionPerOption: z.coerce.number().default(0),
  commissionPerStock: z.coerce.number().default(0),
  optionAssignmentFee: z.coerce.number().default(0),
  isMain: z.string().optional().transform((v) => v === 'true'),
  isActive: z.string().optional().transform((v) => v === 'true'),
})

export async function createAccount(formData: FormData) {
  const userId = await getUserId()
  const { isMain, isActive, ...data } = accountSchema.parse(Object.fromEntries(formData))

  if (isMain) {
    await prisma.account.updateMany({ where: { userId }, data: { isMain: false } })
  }

  await prisma.account.create({
    data: { ...data, userId, isActive, isMain },
  })
  revalidatePath('/accounts', 'page')
  revalidatePath('/dashboard', 'page')
}

export async function updateAccount(id: string, formData: FormData) {
  const userId = await getUserId()
  const { isMain, isActive, ...data } = accountSchema.parse(Object.fromEntries(formData))

  if (isMain) {
    await prisma.account.updateMany({ where: { userId }, data: { isMain: false } })
  }

  await prisma.account.update({
    where: { id, userId },
    data: { ...data, isMain, isActive },
  })
  revalidatePath('/accounts', 'page')
  revalidatePath('/dashboard', 'page')
}

export async function deleteAccount(id: string) {
  const userId = await getUserId()
  await prisma.account.delete({ where: { id, userId } })
  revalidatePath('/accounts', 'page')
}

export async function setMainAccount(id: string) {
  const userId = await getUserId()
  await prisma.$transaction([
    prisma.account.updateMany({ where: { userId }, data: { isMain: false } }),
    prisma.account.update({ where: { id, userId }, data: { isMain: true } }),
  ])
  revalidatePath('/accounts', 'page')
  revalidatePath('/dashboard', 'page')
}
