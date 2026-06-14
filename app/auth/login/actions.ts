'use server'

import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { createSession, destroySession, verifyPassword } from '@/lib/auth'

export interface LoginState {
  error: string
}

export async function loginAction(
  _prevState: LoginState | null,
  formData: FormData,
): Promise<LoginState | null> {
  const email    = (formData.get('email')    as string | null)?.trim().toLowerCase() ?? ''
  const password = (formData.get('password') as string | null) ?? ''

  const coach = await prisma.coach.findUnique({
    where:  { email },
    select: { id: true, name: true, alias: true, email: true, passwordHash: true, role: true, isActive: true },
  })

  const invalid = !coach || !coach.passwordHash
  const passwordOk = invalid ? false : await verifyPassword(password, coach.passwordHash!)

  if (invalid || !passwordOk) {
    return { error: 'Invalid email or password.' }
  }

  if (!coach.isActive) {
    return { error: 'This account has been deactivated. Contact your league administrator.' }
  }

  await createSession({ coachId: coach.id, name: coach.name, alias: coach.alias, email: coach.email, role: coach.role })
  redirect('/')
}

export async function logoutAction(): Promise<void> {
  await destroySession()
  redirect('/auth/login')
}
