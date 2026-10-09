'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { SeasonStatus } from '@prisma/client'

const REVALIDATE = '/league-management'

// ── Leagues ─────────────────────────────────────────────────────────────────

export async function createLeague(formData: FormData) {
  const name = (formData.get('name') as string).trim()
  if (!name) return
  await prisma.league.create({ data: { name } })
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
  // Cascade: delete all seasons (which cascade to divisions)
  const seasons = await prisma.season.findMany({ where: { leagueId: id }, select: { id: true } })
  for (const s of seasons) {
    await prisma.division.deleteMany({ where: { seasonId: s.id } })
  }
  await prisma.season.deleteMany({ where: { leagueId: id } })
  await prisma.league.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}

// ── Seasons ──────────────────────────────────────────────────────────────────

export async function createSeason(formData: FormData) {
  const name     = (formData.get('name')     as string).trim()
  const leagueId =  formData.get('leagueId') as string
  const season   = parseInt(formData.get('season') as string, 10)
  if (!name || !leagueId || isNaN(season)) return
  const league = await prisma.league.findUnique({ where: { id: leagueId } })
  if (!league) return
  await prisma.season.create({ data: { name, leagueId, season, status: 'PLANNING' } })
  revalidatePath(REVALIDATE)
}

export async function renameSeason(formData: FormData) {
  const id   = formData.get('id')   as string
  const name = (formData.get('name') as string).trim()
  if (!name) return
  await prisma.season.update({ where: { id }, data: { name } })
  revalidatePath(REVALIDATE)
}

export async function setSeasonStatus(formData: FormData) {
  const id     = formData.get('id')     as string
  const status = formData.get('status') as string
  if (!['PLANNING', 'READY', 'ACTIVE', 'ENDED'].includes(status)) return
  await prisma.season.update({ where: { id }, data: { status: status as SeasonStatus } })
  revalidatePath(REVALIDATE)
}

export async function deleteSeason(formData: FormData) {
  const id = formData.get('id') as string
  const divCount = await prisma.division.count({ where: { seasonId: id } })
  if (divCount > 0) return // blocked — divisions exist
  const matchCount = await prisma.match.count({ where: { seasonId: id } })
  if (matchCount > 0) return // blocked — matches exist
  await prisma.season.delete({ where: { id } })
  revalidatePath(REVALIDATE)
}

// ── Helpers ──────────────────────────────────────────────────────────────────

async function seasonStatusForDivision(divisionId: string): Promise<SeasonStatus | null> {
  const div = await prisma.division.findUnique({
    where: { id: divisionId },
    select: { season: { select: { status: true } } },
  })
  return div?.season.status ?? null
}

// ── Divisions ────────────────────────────────────────────────────────────────

export async function createDivision(formData: FormData) {
  const name     = (formData.get('name')     as string).trim()
  const seasonId =  formData.get('seasonId') as string
  if (!name || !seasonId) return
  const season = await prisma.season.findUnique({ where: { id: seasonId }, select: { status: true } })
  if (season?.status === 'ENDED') return
  await prisma.division.create({ data: { name, seasonId } })
  revalidatePath(REVALIDATE)
}

export async function renameDivision(formData: FormData) {
  const id   = formData.get('id')   as string
  const name = (formData.get('name') as string).trim()
  if (!name) return
  if (await seasonStatusForDivision(id) === 'ENDED') return
  await prisma.division.update({ where: { id }, data: { name } })
  revalidatePath(REVALIDATE)
}

export async function toggleDivisionVisibility(formData: FormData) {
  const id = formData.get('id') as string
  const div = await prisma.division.findUnique({
    where: { id },
    select: { isHidden: true, season: { select: { status: true } } },
  })
  if (!div) return
  if (div.season.status === 'ENDED') return
  await prisma.division.update({ where: { id }, data: { isHidden: !div.isHidden } })
  revalidatePath(REVALIDATE)
}

export async function deleteDivision(formData: FormData) {
  const id = formData.get('id') as string
  if (await seasonStatusForDivision(id) === 'ENDED') return
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
  if (await seasonStatusForDivision(divisionId) === 'ENDED') return
  await prisma.team.update({ where: { id: teamId }, data: { divisionId } })
  revalidatePath(REVALIDATE)
}

export async function removeTeamFromDivision(formData: FormData) {
  const teamId = formData.get('teamId') as string
  if (!teamId) return
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { divisionId: true } })
  if (!team?.divisionId) return
  if (await seasonStatusForDivision(team.divisionId) === 'ENDED') return
  await prisma.team.update({ where: { id: teamId }, data: { divisionId: null } })
  revalidatePath(REVALIDATE)
}
