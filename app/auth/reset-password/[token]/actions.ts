'use server'

import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { hashPassword, createSession } from '@/lib/auth'
import { hashResetToken } from '@/lib/reset-token'

export interface ResetState {
  error?: string
}

export async function resetPasswordAction(
  _prevState: ResetState | null,
  formData: FormData,
): Promise<ResetState | null> {
  const token   = formData.get('token')    as string
  const password = formData.get('password') as string
  const confirm  = formData.get('confirm')  as string

  if (!password || password.length < 8) {
    return { error: 'Password must be at least 8 characters.' }
  }
  if (password !== confirm) {
    return { error: 'Passwords do not match.' }
  }

  const tokenHash = hashResetToken(token)
  const record = await prisma.passwordResetToken.findUnique({
    where:  { tokenHash },
    include: { coach: { select: { id: true, name: true, alias: true, email: true, role: true, isActive: true } } },
  })

  if (!record || record.usedAt || record.expiresAt < new Date()) {
    return { error: 'This reset link is invalid or has expired.' }
  }

  const passwordHash = await hashPassword(password)
  await prisma.$transaction([
    prisma.coach.update({ where: { id: record.coachId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ])

  const coach = record.coach
  if (coach.isActive) {
    await createSession({ coachId: coach.id, name: coach.name, alias: coach.alias, email: coach.email, role: coach.role })
  }
  redirect('/')
}
