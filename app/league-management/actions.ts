'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { LeagueStatus } from '@prisma/client'

const REVALIDATE = '/league-management'

// ── Leagues ─────────────────────────────────────────────────────────────────

export async function createLeague(formData: FormData) {
  const name   = (formData.get('name')   as string).trim()
  const season = parseInt(formData.get('season') as string, 10)
  if (!name || isNaN(season)) return
  await prisma.league.create({ data: { name, season } })
  revalidatePath(REVALIDATE)
}

export async function renameLeague(formData: FormData) {
  const id   = formData.get('id')   as string
  const name = (formData.get('name') as string).trim()
  if (!name) return
  await prisma.league.update({ where: { id }, data: { name } })
  revalidatePath(REVALIDATE)
}

export async function toggleLeagueVisibility(formData: FormData) {
  const id = formData.get('id') as string
  const league = await prisma.league.findUnique({ where: { id }, select: { isHidden: true } })
  if (!league) return
  await prisma.league.update({ where: { id }, data: { isHidden: !league.isHidden } })
  revalidatePath(REVALIDATE)
}

export async function deleteLeague(formData: FormData) {
  const id = formData.get('id') as string
  const count = await prisma.team.count({ where: { leagueId: id } })
  if (count > 0) return // blocked — teams exist
  // also delete any divisions first
  await prisma.division.deleteMany({ where: { leagueId: id } })
  await prisma.league.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}

export async function setLeagueStatus(formData: FormData) {
  const id     = formData.get('id')     as string
  const status = formData.get('status') as string
  if (!['READY', 'ACTIVE', 'ENDED'].includes(status)) return
  await prisma.league.update({ where: { id }, data: { status: status as LeagueStatus } })
  revalidatePath(REVALIDATE)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function leagueStatusForDivision(divisionId: string): Promise<LeagueStatus | null> {
  const div = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { league: { select: { status: true } } },
  })
  return div?.league.status ?? null
}

// ── Divisions ────────────────────────────────────────────────────────────────

export async function createDivision(formData: FormData) {
  const name     = (formData.get('name')     as string).trim()
  const leagueId =  formData.get('leagueId') as string
  if (!name || !leagueId) return
  const league = await prisma.league.findUnique({ where: { id: leagueId }, select: { status: true } })
  if (league?.status === 'ENDED') return
  await prisma.division.create({ data: { name, leagueId } })
  revalidatePath(REVALIDATE)
}

export async function renameDivision(formData: FormData) {
  const id   = formData.get('id')   as string
  const name = (formData.get('name') as string).trim()
  if (!name) return
  if (await leagueStatusForDivision(id) === 'ENDED') return
  await prisma.division.update({ where: { id }, data: { name } })
  revalidatePath(REVALIDATE)
}

export async function toggleDivisionVisibility(formData: FormData) {
  const id = formData.get('id') as string
  const div = await prisma.division.findUnique({
    where: { id },
    select: { isHidden: true, league: { select: { status: true } } },
  })
  if (!div) return
  if (div.league.status === 'ENDED') return
  await prisma.division.update({ where: { id }, data: { isHidden: !div.isHidden } })
  revalidatePath(REVALIDATE)
}

export async function deleteDivision(formData: FormData) {
  const id = formData.get('id') as string
  if (await leagueStatusForDivision(id) === 'ENDED') return
  const count = await prisma.team.count({ where: { divisionId: id } })
  if (count > 0) return // blocked — teams assigned
  await prisma.division.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}

// ── Team assignment ──────────────────────────────────────────────────────────

export async function assignTeamToDivision(formData: FormData) {
  const teamId     = formData.get('teamId')     as string
  const divisionId = formData.get('divisionId') as string
  if (!teamId || !divisionId) return
  if (await leagueStatusForDivision(divisionId) === 'ENDED') return
  await prisma.team.update({ where: { id: teamId }, data: { divisionId } })
  revalidatePath(REVALIDATE)
}

export async function removeTeamFromDivision(formData: FormData) {
  const teamId = formData.get('teamId') as string
  if (!teamId) return
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { divisionId: true } })
  if (!team?.divisionId) return
  if (await leagueStatusForDivision(team.divisionId) === 'ENDED') return
  await prisma.team.update({ where: { id: teamId }, data: { divisionId: null } })
  revalidatePath(REVALIDATE)
}
