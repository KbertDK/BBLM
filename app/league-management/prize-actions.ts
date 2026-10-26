'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

async function requireCommish() {
  const session = await getSession()
  if (!session || (session.role !== 'COMMISH' && session.role !== 'ADMIN')) return null
  return session
}

export async function createPrizeType(formData: FormData) {
  if (!await requireCommish()) return

  const name = (formData.get('name') as string)?.trim()
  const type = formData.get('type') as string
  const icon = (formData.get('icon') as string) ?? ''

  if (!name || (type !== 'TEAM' && type !== 'PLAYER')) return

  await prisma.prizeType.create({
    data: { name, type, icon },
  })

  revalidatePath('/league-management')
}

export async function updatePrizeType(formData: FormData) {
  if (!await requireCommish()) return

  const id   = formData.get('id')   as string
  const name = (formData.get('name') as string)?.trim()
  const type = formData.get('type') as string
  const icon = (formData.get('icon') as string) ?? ''

  if (!id || !name || (type !== 'TEAM' && type !== 'PLAYER')) return

  await prisma.prizeType.update({
    where: { id },
    data:  { name, type, icon },
  })

  revalidatePath('/league-management')
}

export async function togglePrizeTypeStatus(formData: FormData) {
  if (!await requireCommish()) return

  const id = formData.get('id') as string
  if (!id) return

  const current = await prisma.prizeType.findUnique({ where: { id }, select: { status: true } })
  if (!current) return

  await prisma.prizeType.update({
    where: { id },
    data:  { status: current.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE' },
  })

  revalidatePath('/league-management')
}

export async function deletePrizeType(formData: FormData) {
  if (!await requireCommish()) return

  const id = formData.get('id') as string
  if (!id) return

  const pt = await prisma.prizeType.findUnique({
    where:  { id },
    select: { _count: { select: { awards: true } } },
  })
  if (!pt || pt._count.awards > 0) return

  await prisma.prizeType.delete({ where: { id } })
  revalidatePath('/league-management')
}

export async function awardPrize(formData: FormData) {
  if (!await requireCommish()) return

  const prizeTypeId  = formData.get('prizeTypeId')  as string
  const tournamentId = formData.get('tournamentId') as string
  const teamId       = (formData.get('teamId')       as string | null) || null
  const teamPlayerId = (formData.get('teamPlayerId') as string | null) || null

  if (!prizeTypeId || !tournamentId) return
  if (!teamId && !teamPlayerId) return

  // Upsert: one award per prize+tournament
  await prisma.prizeAward.deleteMany({ where: { prizeTypeId, tournamentId } })
  await prisma.prizeAward.create({
    data: { prizeTypeId, tournamentId, teamId, teamPlayerId },
  })

  revalidatePath('/league-management')
}

export async function removeAward(formData: FormData) {
  if (!await requireCommish()) return

  const id = formData.get('id') as string
  if (!id) return

  await prisma.prizeAward.delete({ where: { id } })
  revalidatePath('/league-management')
}
