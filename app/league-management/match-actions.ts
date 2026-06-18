'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

async function requireCommish() {
  const session = await getSession()
  if (!session || (session.role !== 'COMMISH' && session.role !== 'ADMIN')) return null
  return session
}

export async function createMatch(formData: FormData) {
  if (!await requireCommish()) return

  const leagueId     = formData.get('leagueId')     as string
  const tournamentId = (formData.get('tournamentId') as string) || null
  const homeTeamId   = formData.get('homeTeamId')   as string
  const awayTeamId   = formData.get('awayTeamId')   as string
  const round        = parseInt((formData.get('round') as string) ?? '1', 10)
  const rawDate      = (formData.get('scheduledAt') as string | null) ?? ''
  const scheduledAt  = rawDate ? new Date(rawDate) : null

  if (!leagueId || !tournamentId || !homeTeamId || !awayTeamId || homeTeamId === awayTeamId) return
  if (isNaN(round) || round < 1) return
  if (scheduledAt && isNaN(scheduledAt.getTime())) return

  // Both teams must be in the same league and same division
  const teams = await prisma.team.findMany({
    where:  { id: { in: [homeTeamId, awayTeamId] }, leagueId },
    select: { id: true, divisionId: true },
  })
  if (teams.length !== 2) return
  if (teams[0].divisionId !== teams[1].divisionId) return

  // Block duplicate pairing in the same round
  const conflict = await prisma.match.findFirst({
    where: {
      leagueId, round,
      OR: [
        { homeTeamId, awayTeamId },
        { homeTeamId: awayTeamId, awayTeamId: homeTeamId },
      ],
    },
  })
  if (conflict) return

  await prisma.match.create({
    data: { leagueId, tournamentId, homeTeamId, awayTeamId, round, scheduledAt, status: 'SCHEDULED' },
  })

  revalidatePath('/league-management')
}

export async function deleteMatch(formData: FormData) {
  if (!await requireCommish()) return

  const matchId = formData.get('matchId') as string
  if (!matchId) return

  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { status: true } })
  if (!match || match.status !== 'SCHEDULED') return

  await prisma.match.delete({ where: { id: matchId } })
  revalidatePath('/league-management')
}

export async function setMatchLive(formData: FormData) {
  if (!await requireCommish()) return

  const matchId = formData.get('matchId') as string
  if (!matchId) return

  await prisma.match.update({ where: { id: matchId }, data: { status: 'LIVE' } })
  revalidatePath('/league-management')
}

export async function completeMatch(formData: FormData) {
  if (!await requireCommish()) return

  const matchId   = formData.get('matchId')   as string
  const homeScore = parseInt((formData.get('homeScore') as string) ?? '', 10)
  const awayScore = parseInt((formData.get('awayScore') as string) ?? '', 10)

  if (!matchId || isNaN(homeScore) || isNaN(awayScore) || homeScore < 0 || awayScore < 0) return

  const match = await prisma.match.findUnique({
    where:  { id: matchId },
    select: { homeTeamId: true, awayTeamId: true },
  })
  if (!match) return

  const homeWin = homeScore > awayScore
  const awayWin = awayScore > homeScore
  const isDraw  = homeScore === awayScore

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data:  { status: 'COMPLETED', homeScore, awayScore },
    }),
    prisma.team.update({
      where: { id: match.homeTeamId },
      data: {
        wins:   { increment: homeWin ? 1 : 0 },
        losses: { increment: awayWin ? 1 : 0 },
        draws:  { increment: isDraw  ? 1 : 0 },
      },
    }),
    prisma.team.update({
      where: { id: match.awayTeamId },
      data: {
        wins:   { increment: awayWin ? 1 : 0 },
        losses: { increment: homeWin ? 1 : 0 },
        draws:  { increment: isDraw  ? 1 : 0 },
      },
    }),
  ])

  revalidatePath('/league-management')
}

// ── Round Robin ────────────────────────────────────────────────────────────────

function circleRoundRobin(ids: string[]): [string, string][][] {
  const list = ids.length % 2 === 0 ? [...ids] : [...ids, 'BYE']
  const n = list.length
  const rounds: [string, string][][] = []

  for (let r = 0; r < n - 1; r++) {
    const pairs: [string, string][] = []
    for (let i = 0; i < n / 2; i++) {
      const h = list[i]
      const a = list[n - 1 - i]
      if (h !== 'BYE' && a !== 'BYE') pairs.push([h, a])
    }
    rounds.push(pairs)
    // Keep list[0] fixed, rotate the rest right
    list.splice(1, 0, list.pop()!)
  }
  return rounds
}

export async function generateRoundRobin(formData: FormData) {
  if (!await requireCommish()) return

  const leagueId     = formData.get('leagueId')     as string
  const divisionId   = formData.get('divisionId')   as string
  const tournamentId = (formData.get('tournamentId') as string) || null
  const startRound   = parseInt((formData.get('startRound') as string) ?? '1', 10)

  if (!leagueId || !divisionId || !tournamentId || isNaN(startRound) || startRound < 1) return

  const divTeams = await prisma.team.findMany({
    where:   { leagueId, divisionId },
    select:  { id: true },
    orderBy: { name: 'asc' },
  })
  if (divTeams.length < 2) return

  const teamIds  = divTeams.map((t) => t.id)
  const schedule = circleRoundRobin(teamIds)

  // Build a map of which rounds each team is already committed to.
  // A pair is only skipped when one of the two teams already has a match
  // in that specific round — not because the pair has met before.
  // This ensures every free team gets a slot in every round.
  const existing = await prisma.match.findMany({
    where:  { leagueId },
    select: { homeTeamId: true, awayTeamId: true, round: true },
  })
  const teamRounds = new Map<string, Set<number>>()
  for (const m of existing) {
    if (!teamRounds.has(m.homeTeamId)) teamRounds.set(m.homeTeamId, new Set())
    if (!teamRounds.has(m.awayTeamId)) teamRounds.set(m.awayTeamId, new Set())
    teamRounds.get(m.homeTeamId)!.add(m.round)
    teamRounds.get(m.awayTeamId)!.add(m.round)
  }

  const toCreate: { leagueId: string; tournamentId: string; homeTeamId: string; awayTeamId: string; round: number; status: 'SCHEDULED' }[] = []

  for (let ri = 0; ri < schedule.length; ri++) {
    const round = startRound + ri
    for (const [h, a] of schedule[ri]) {
      if (teamRounds.get(h)?.has(round) || teamRounds.get(a)?.has(round)) continue
      toCreate.push({ leagueId, tournamentId, homeTeamId: h, awayTeamId: a, round, status: 'SCHEDULED' })
    }
  }

  if (toCreate.length > 0) {
    await prisma.match.createMany({ data: toCreate })
  }

  revalidatePath('/league-management')
}

// ── Bulk date setter ───────────────────────────────────────────────────────────

export async function bulkSetMatchDates(formData: FormData) {
  if (!await requireCommish()) return

  const matchIds   = formData.getAll('matchId') as string[]
  const rawDate    = (formData.get('scheduledAt') as string | null) ?? ''
  const scheduledAt = rawDate ? new Date(rawDate) : null

  if (matchIds.length === 0 || !scheduledAt || isNaN(scheduledAt.getTime())) return

  await prisma.match.updateMany({
    where: { id: { in: matchIds }, status: 'SCHEDULED' },
    data:  { scheduledAt },
  })

  revalidatePath('/league-management')
}
