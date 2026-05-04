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

const setupSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
})

export async function createSetup(formData: FormData) {
  const userId = await getUserId()
  const data = setupSchema.parse(Object.fromEntries(formData))
  await prisma.setup.create({ data: { ...data, userId } })
  revalidatePath('/system', 'page')
}

export async function updateSetup(id: string, formData: FormData) {
  const userId = await getUserId()
  const data = setupSchema.parse(Object.fromEntries(formData))
  await prisma.setup.update({ where: { id, userId }, data })
  revalidatePath('/system', 'page')
}

export async function deleteSetup(id: string) {
  const userId = await getUserId()
  await prisma.setup.delete({ where: { id, userId } })
  revalidatePath('/system', 'page')
}
