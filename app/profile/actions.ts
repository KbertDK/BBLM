'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession, createSession } from '@/lib/auth'

export async function updateProfile(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const alias   = (formData.get('alias')   as string).trim()
  const email   = (formData.get('email')   as string).trim().toLowerCase()
  const phone   = (formData.get('phone')   as string).trim()
  const name    = (formData.get('name')    as string).trim()
  const address = (formData.get('address') as string).trim() || null
  const zip     = (formData.get('zip')     as string).trim() || null
  const city    = (formData.get('city')    as string).trim() || null

  if (!alias || !email || !phone) return

  try {
    await prisma.coach.update({
      where: { id: session.coachId },
      data:  { alias, email, phone, name: name || session.name, address, zip, city },
    })
  } catch {
    // unique constraint on alias or email
    return
  }

  // Refresh JWT so navbar picks up new alias immediately
  await createSession({
    coachId: session.coachId,
    name:    name || session.name,
    alias,
    email,
    role:    session.role,
  })

  revalidatePath('/profile')
}
