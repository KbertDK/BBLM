'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'

const REVALIDATE = '/league-management'

export async function createTournament(formData: FormData) {
  const name         = (formData.get('name')       as string).trim()
  const divisionId   =  formData.get('divisionId') as string
  const crossDivision = formData.get('crossDivision') === '1'
  if (!name || !divisionId) return
  await prisma.tournament.create({
    data: {
      name,
      crossDivision,
      divisions: { connect: { id: divisionId } },
    },
  })
  revalidatePath(REVALIDATE)
}

export async function renameTournament(formData: FormData) {
  const id   =  formData.get('id')   as string
  const name = (formData.get('name') as string).trim()
  if (!name) return
  await prisma.tournament.update({ where: { id }, data: { name } })
  revalidatePath(REVALIDATE)
}

export async function toggleTournamentCrossDiv(formData: FormData) {
  const id = formData.get('id') as string
  const t  = await prisma.tournament.findUnique({ where: { id }, select: { crossDivision: true } })
  if (!t) return
  await prisma.tournament.update({ where: { id }, data: { crossDivision: !t.crossDivision } })
  revalidatePath(REVALIDATE)
}

export async function addDivisionToTournament(formData: FormData) {
  const tournamentId = formData.get('tournamentId') as string
  const divisionId   = formData.get('divisionId')   as string
  if (!tournamentId || !divisionId) return
  await prisma.tournament.update({
    where: { id: tournamentId },
    data:  { divisions: { connect: { id: divisionId } } },
  })
  revalidatePath(REVALIDATE)
}

export async function removeDivisionFromTournament(formData: FormData) {
  const tournamentId = formData.get('tournamentId') as string
  const divisionId   = formData.get('divisionId')   as string
  if (!tournamentId || !divisionId) return
  const t = await prisma.tournament.findUnique({
    where:  { id: tournamentId },
    select: { crossDivision: true, _count: { select: { divisions: true } } },
  })
  if (!t) return
  // Never leave a tournament with 0 divisions
  if (t._count.divisions <= 1) return
  await prisma.tournament.update({
    where: { id: tournamentId },
    data:  { divisions: { disconnect: { id: divisionId } } },
  })
  revalidatePath(REVALIDATE)
}

export async function deleteTournament(formData: FormData) {
  const id = formData.get('id') as string
  await prisma.tournament.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}
