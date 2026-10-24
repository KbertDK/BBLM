'use server'

import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getPendingMfaSession, destroyPendingMfaSession, createSession } from '@/lib/auth'
import { verifyMfaToken } from '@/lib/mfa'

export interface MfaState {
  error: string
}

export async function verifyMfaAction(
  _prevState: MfaState | null,
  formData: FormData,
): Promise<MfaState | null> {
  const code = (formData.get('code') as string | null)?.trim() ?? ''

  const coachId = await getPendingMfaSession()
  if (!coachId) redirect('/auth/login')

  const coach = await prisma.coach.findUnique({
    where:  { id: coachId },
    select: { id: true, name: true, alias: true, email: true, role: true, mfaSecret: true, isActive: true },
  })

  if (!coach || !coach.isActive || !coach.mfaSecret) redirect('/auth/login')

  if (!verifyMfaToken(code, coach.mfaSecret)) {
    return { error: 'Invalid code. Check your authenticator app and try again.' }
  }

  await destroyPendingMfaSession()
  await createSession({ coachId: coach.id, name: coach.name, alias: coach.alias, email: coach.email, role: coach.role })
  redirect('/')
}
