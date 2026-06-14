'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession, hashPassword } from '@/lib/auth'
import { CoachRole } from '@prisma/client'

const REVALIDATE = '/league-management'
const VALID_ROLES: string[] = ['ADMIN', 'COMMISH', 'COACH']

async function requireAdmin(): Promise<string | null> {
  const session = await getSession()
  if (session?.role !== 'ADMIN') return null
  return session.coachId
}

export async function createCoach(formData: FormData) {
  const adminId = await requireAdmin()
  if (!adminId) return

  const name     = (formData.get('name')     as string).trim()
  const email    = (formData.get('email')    as string).trim().toLowerCase()
  const password =  formData.get('password') as string
  const role     =  formData.get('role')     as string

  if (!name || !email || !password || !VALID_ROLES.includes(role)) return

  const passwordHash = await hashPassword(password)
  try {
    await prisma.coach.create({ data: { name, email, passwordHash, role: role as CoachRole } })
  } catch {
    // unique email constraint violation — silently ignored
    return
  }
  revalidatePath(REVALIDATE)
}

export async function renameCoach(formData: FormData) {
  const adminId = await requireAdmin()
  if (!adminId) return

  const id   = formData.get('id')   as string
  const name = (formData.get('name') as string).trim()
  if (!name) return

  await prisma.coach.update({ where: { id }, data: { name } })
  revalidatePath(REVALIDATE)
}

export async function updateCoachEmail(formData: FormData) {
  const adminId = await requireAdmin()
  if (!adminId) return

  const id    = formData.get('id')    as string
  const email = (formData.get('email') as string).trim().toLowerCase()
  if (!email) return

  try {
    await prisma.coach.update({ where: { id }, data: { email } })
  } catch {
    return
  }
  revalidatePath(REVALIDATE)
}

export async function resetCoachPassword(formData: FormData) {
  const adminId = await requireAdmin()
  if (!adminId) return

  const id       = formData.get('id')       as string
  const password = formData.get('password') as string
  if (!password || password.length < 6) return

  const passwordHash = await hashPassword(password)
  await prisma.coach.update({ where: { id }, data: { passwordHash } })
  revalidatePath(REVALIDATE)
}

export async function toggleCoachActive(formData: FormData) {
  const adminId = await requireAdmin()
  if (!adminId) return

  const id = formData.get('id') as string
  if (id === adminId) return // cannot deactivate yourself

  const coach = await prisma.coach.findUnique({ where: { id }, select: { isActive: true } })
  if (!coach) return

  await prisma.coach.update({ where: { id }, data: { isActive: !coach.isActive } })
  revalidatePath(REVALIDATE)
}

export async function deleteCoach(formData: FormData) {
  const adminId = await requireAdmin()
  if (!adminId) return

  const id = formData.get('id') as string
  if (id === adminId) return // cannot delete yourself

  const teamCount = await prisma.team.count({ where: { coachId: id } })
  if (teamCount > 0) return // blocked — coach still has teams

  await prisma.coach.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}
