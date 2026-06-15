'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

async function requireMatchParticipant(matchId: string) {
  const session = await getSession()
  if (!session) return null

  const match = await prisma.match.findUnique({
    where:  { id: matchId },
    select: {
      homeTeam: { select: { coachId: true } },
      awayTeam: { select: { coachId: true } },
    },
  })
  if (!match) return null

  const ok =
    session.coachId === match.homeTeam.coachId ||
    session.coachId === match.awayTeam.coachId ||
    session.role === 'COMMISH' ||
    session.role === 'ADMIN'

  return ok ? session : null
}

export async function pushMatchEvent(matchId: string, type: string, label: string, scoringTeam?: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchEvent.create({ data: { matchId, type, label, scoringTeam: scoringTeam ?? null } })
  revalidatePath('/')
}

export async function deleteLastMatchEvent(matchId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const last = await prisma.matchEvent.findFirst({
    where:   { matchId },
    orderBy: { createdAt: 'desc' },
    select:  { id: true },
  })
  if (!last) return
  await prisma.matchEvent.delete({ where: { id: last.id } })
  revalidatePath('/')
}

export async function startMatch(matchId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return

  await prisma.match.updateMany({
    where: { id: matchId, status: 'SCHEDULED' },
    data:  { status: 'LIVE' },
  })

  revalidatePath('/')
  revalidatePath('/league-management')
}

interface PlayerUpdate {
  playerId: string
  deltaTouchdowns: number
  deltaCompletePasses: number
  deltaInterceptions: number
  deltaCasualties: number
  deltaSSP: number
  deltaMVP: number
  newStatus: 'ACTIVE' | 'MNG' | 'DEAD' | null
  isDeathPost: boolean
}

interface EventRecord {
  type:  string
  label: string
}

interface CompletePayload {
  matchId: string
  homeScore: number
  awayScore: number
  homeWinnings: number
  awayWinnings: number
  playerUpdates: PlayerUpdate[]
  events: EventRecord[]
}

export async function completeMatchFull(formData: FormData) {
  const raw = formData.get('payload') as string | null
  if (!raw) return

  let payload: CompletePayload
  try { payload = JSON.parse(raw) } catch { return }

  const { matchId, homeScore, awayScore, homeWinnings, awayWinnings, playerUpdates, events = [] } = payload

  const session = await requireMatchParticipant(matchId)
  if (!session) return

  const match = await prisma.match.findUnique({
    where:  { id: matchId },
    select: {
      status:     true,
      homeTeamId: true,
      awayTeamId: true,
      homeTeam:   { select: { name: true } },
      awayTeam:   { select: { name: true } },
    },
  })
  if (!match || match.status === 'COMPLETED') return

  const homeWin = homeScore > awayScore
  const awayWin = awayScore > homeScore
  const isDraw  = homeScore === awayScore

  const deathIds = playerUpdates.filter((u) => u.isDeathPost).map((u) => u.playerId)
  const deathPlayers = deathIds.length > 0
    ? await prisma.teamPlayer.findMany({
        where:  { id: { in: deathIds } },
        select: { id: true, name: true, teamId: true, playerType: { select: { name: true } } },
      })
    : []

  const playerMap  = new Map(deathPlayers.map((p) => [p.id, p]))
  const teamNames  = new Map<string, string>([
    [match.homeTeamId, match.homeTeam.name],
    [match.awayTeamId, match.awayTeam.name],
  ])

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data:  { status: 'COMPLETED', homeScore, awayScore },
    }),
    prisma.team.update({
      where: { id: match.homeTeamId },
      data: {
        wins:     { increment: homeWin ? 1 : 0 },
        losses:   { increment: awayWin ? 1 : 0 },
        draws:    { increment: isDraw  ? 1 : 0 },
        treasury: { increment: homeWinnings },
      },
    }),
    prisma.team.update({
      where: { id: match.awayTeamId },
      data: {
        wins:     { increment: awayWin ? 1 : 0 },
        losses:   { increment: homeWin ? 1 : 0 },
        draws:    { increment: isDraw  ? 1 : 0 },
        treasury: { increment: awayWinnings },
      },
    }),
    ...playerUpdates.map((u) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: Record<string, any> = {
        touchdowns:     { increment: u.deltaTouchdowns },
        completePasses: { increment: u.deltaCompletePasses },
        interceptions:  { increment: u.deltaInterceptions },
        casualties:     { increment: u.deltaCasualties },
        ssp:            { increment: u.deltaSSP },
        mvp:            { increment: u.deltaMVP },
      }
      if (u.newStatus !== null) data.status = u.newStatus
      return prisma.teamPlayer.update({ where: { id: u.playerId }, data })
    }),
    ...deathIds.map((pid) => {
      const p = playerMap.get(pid)
      const playerName = p?.name?.trim() || 'An unnamed warrior'
      const teamName   = p ? (teamNames.get(p.teamId) ?? 'their team') : 'their team'
      const position   = p?.playerType.name ?? 'player'
      return prisma.newsPost.create({
        data: {
          title:    `${playerName} of ${teamName} has fallen!`,
          body:     `${playerName}, ${position} for ${teamName}, was slain on the Blood Bowl pitch. They will be remembered — and mourned — by those brave enough to take the field after them.`,
          authorId: session.coachId,
          teamId:   p?.teamId,
          playerId: pid,
        },
      })
    }),
  ])

  // Sync the authoritative event log from the client — wipe any partially-saved
  // events and replace with the complete ordered list from local state.
  if (events.length > 0) {
    const base = Date.now()
    await prisma.$transaction([
      prisma.matchEvent.deleteMany({ where: { matchId } }),
      prisma.matchEvent.createMany({
        data: events.map((e, i) => ({
          matchId,
          type:      e.type,
          label:     e.label,
          createdAt: new Date(base + i),   // 1 ms apart preserves order
        })),
      }),
    ])
  }

  revalidatePath('/')
  revalidatePath('/league-management')
  revalidatePath(`/teams/${match.homeTeamId}`)
  revalidatePath(`/teams/${match.awayTeamId}`)

  redirect(`/teams/${match.homeTeamId}`)
}
