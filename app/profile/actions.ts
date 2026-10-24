'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession, createSession, hashPassword, verifyPassword } from '@/lib/auth'
import { generateMfaSecret, generateQrDataUrl, verifyMfaToken } from '@/lib/mfa'

export async function updateProfile(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const alias           = (formData.get('alias')   as string).trim()
  const email           = (formData.get('email')   as string).trim().toLowerCase()
  const phone           = (formData.get('phone')   as string).trim()
  const name            = (formData.get('name')    as string).trim()
  const address         = (formData.get('address') as string).trim() || null
  const zip             = (formData.get('zip')     as string).trim() || null
  const city            = (formData.get('city')    as string).trim() || null
  const primaryLeagueId = (formData.get('primaryLeagueId') as string) || null

  if (!alias || !email || !phone) return

  try {
    await prisma.coach.update({
      where: { id: session.coachId },
      data:  { alias, email, phone, name: name || session.name, address, zip, city, primaryLeagueId },
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

// ── Change password (self-service, requires current password) ──

export interface ChangePasswordState {
  error?: string
  success?: boolean
}

export async function changePassword(
  _prevState: ChangePasswordState | null,
  formData: FormData,
): Promise<ChangePasswordState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const current = formData.get('current')  as string
  const next    = formData.get('next')     as string
  const confirm = formData.get('confirm')  as string

  if (!next || next.length < 8) return { error: 'New password must be at least 8 characters.' }
  if (next !== confirm)         return { error: 'Passwords do not match.' }

  const coach = await prisma.coach.findUnique({
    where:  { id: session.coachId },
    select: { passwordHash: true },
  })
  if (!coach?.passwordHash) return { error: 'No password set on this account.' }

  const ok = await verifyPassword(current, coach.passwordHash)
  if (!ok) return { error: 'Current password is incorrect.' }

  await prisma.coach.update({
    where: { id: session.coachId },
    data:  { passwordHash: await hashPassword(next) },
  })
  return { success: true }
}

// ── MFA setup ──

export interface MfaSetupState {
  error?:     string
  qrDataUrl?: string
  secret?:    string
}

export async function setupMfa(
  _prevState: MfaSetupState | null,
  _formData: FormData,
): Promise<MfaSetupState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const coach = await prisma.coach.findUnique({
    where:  { id: session.coachId },
    select: { email: true },
  })
  if (!coach) redirect('/auth/login')

  const secret = generateMfaSecret()
  await prisma.coach.update({
    where: { id: session.coachId },
    data:  { mfaSecret: secret, mfaEnabled: false },
  })

  const qrDataUrl = await generateQrDataUrl(coach.email, secret)
  return { qrDataUrl, secret }
}

export interface MfaConfirmState {
  error?:   string
  success?: boolean
}

export async function confirmMfa(
  _prevState: MfaConfirmState | null,
  formData: FormData,
): Promise<MfaConfirmState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const code = (formData.get('code') as string | null)?.trim() ?? ''

  const coach = await prisma.coach.findUnique({
    where:  { id: session.coachId },
    select: { mfaSecret: true },
  })
  if (!coach?.mfaSecret) return { error: 'Start setup again — no pending secret found.' }

  if (!verifyMfaToken(code, coach.mfaSecret)) {
    return { error: 'Code did not match. Try again.' }
  }

  await prisma.coach.update({
    where: { id: session.coachId },
    data:  { mfaEnabled: true },
  })
  revalidatePath('/profile')
  return { success: true }
}

export interface MfaDisableState {
  error?:   string
  success?: boolean
}

export async function disableMfa(
  _prevState: MfaDisableState | null,
  formData: FormData,
): Promise<MfaDisableState> {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const password = formData.get('password') as string

  const coach = await prisma.coach.findUnique({
    where:  { id: session.coachId },
    select: { passwordHash: true },
  })
  if (!coach?.passwordHash) return { error: 'No password set on this account.' }

  const ok = await verifyPassword(password, coach.passwordHash)
  if (!ok) return { error: 'Password is incorrect.' }

  await prisma.coach.update({
    where: { id: session.coachId },
    data:  { mfaEnabled: false, mfaSecret: null },
  })
  revalidatePath('/profile')
  return { success: true }
}
