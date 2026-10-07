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

// Maps short game event codes to MdMatchEvent names for FK lookup
const MD_EVENT_NAME: Record<string, string> = {
  TD:            'Touch Down',
  INTERCEPTION:  'Interception',
  CASUALTY:      'Block',  // default cause; specific cause can be set manually via Data Manager
}

async function resolveMdMatchEventId(type: string): Promise<string | null> {
  const name = MD_EVENT_NAME[type]
  if (!name) return null
  const found = await prisma.mdMatchEvent.findFirst({ where: { name }, select: { id: true } })
  return found?.id ?? null
}

export async function pushMatchEvent(matchId: string, type: string, label: string, scoringTeam?: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const mdMatchEventId = await resolveMdMatchEventId(type)
  await prisma.matchEvent.create({ data: { matchId, type, label, scoringTeam: scoringTeam ?? null, mdMatchEventId } })
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

export async function savePrematchData(matchId: string, data: {
  homeTeamValue:     number
  awayTeamValue:     number
  homeTeamFanFactor: number
  awayTeamFanFactor: number
}) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.match.update({ where: { id: matchId }, data })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireMerc(matchId: string, side: 'home' | 'away', playerTypeId: string, cost: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchMerc.create({ data: { matchId, side, playerTypeId, cost } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeMerc(matchId: string, mercId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchMerc.deleteMany({ where: { id: mercId, matchId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireStarPlayer(matchId: string, side: 'home' | 'away', starPlayerId: string, price: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const exists = await prisma.matchStarPlayer.findFirst({ where: { matchId, side, starPlayerId } })
  if (exists) return
  await prisma.matchStarPlayer.create({ data: { matchId, side, starPlayerId, price } })
  // Auto-hire companions (Grotty with Brick, Dribl with Drull, Valen with Lucian)
  const sp = await prisma.mdStarPlayer.findUnique({
    where: { id: starPlayerId },
    select: { companions: { select: { id: true } } },
  })
  if (sp?.companions.length) {
    await prisma.matchStarPlayer.createMany({
      data: sp.companions.map((c) => ({ matchId, side, starPlayerId: c.id, price: 0, isCompanion: true })),
      skipDuplicates: true,
    })
  }
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeStarPlayer(matchId: string, id: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const record = await prisma.matchStarPlayer.findUnique({ where: { id } })
  if (!record || record.isCompanion) return
  const sp = await prisma.mdStarPlayer.findUnique({
    where: { id: record.starPlayerId },
    select: { companions: { select: { id: true } } },
  })
  if (sp?.companions.length) {
    await prisma.matchStarPlayer.deleteMany({
      where: { matchId, side: record.side, starPlayerId: { in: sp.companions.map((c) => c.id) } },
    })
  }
  await prisma.matchStarPlayer.delete({ where: { id } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireJourneyman(matchId: string, side: 'home' | 'away', playerTypeId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchJourneyman.create({ data: { matchId, side, playerTypeId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeJourneyman(matchId: string, id: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchJourneyman.deleteMany({ where: { id, matchId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function updateJourneymanNumber(matchId: string, journeymanId: string, number: number | null) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  if (number !== null && (number < 1 || number > 99)) return
  await prisma.matchJourneyman.updateMany({ where: { id: journeymanId, matchId }, data: { number } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireInducement(matchId: string, side: 'home' | 'away', inducementId: string, cost: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const inducement = await prisma.mdInducement.findUnique({ where: { id: inducementId } })
  if (!inducement) return
  const count = await prisma.matchInducement.count({ where: { matchId, side, inducementId } })
  if (count >= inducement.maxCount) return
  await prisma.matchInducement.create({ data: { matchId, side, inducementId, cost } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeInducement(matchId: string, id: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchInducement.deleteMany({ where: { id, matchId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function markInducementUsed(matchId: string, id: string, half?: 1 | 2) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const data = half === 1 ? { chefHalf1Used: true } : half === 2 ? { chefHalf2Used: true } : { used: true }
  await prisma.matchInducement.updateMany({ where: { id, matchId }, data })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function markApothecaryUsed(matchId: string, side: 'home' | 'away') {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.match.updateMany({
    where: { id: matchId },
    data: side === 'home' ? { homeApothecaryUsed: true } : { awayApothecaryUsed: true },
  })
  revalidatePath(`/matches/${matchId}/game`)
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

interface JourneymanUpdate {
  id: string
  deltaTouchdowns: number
  deltaCompletePasses: number
  deltaInterceptions: number
  deltaCasualties: number
  deltaMVP: number
  deltaSSP: number
  injuryStatus: 'ACTIVE' | 'MNG' | 'DEAD'
}

interface MercStarUpdate {
  id: string
  deltaMVP: number
}

interface RosterStatRow {
  playerId: string
  touchdowns: number
  completePasses: number
  interceptions: number
  casualties: number
  mvp: number
  ssp: number
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
  journeymanUpdates: JourneymanUpdate[]
  mercUpdates: MercStarUpdate[]
  starUpdates: MercStarUpdate[]
  rosterStatRows: RosterStatRow[]
  events: EventRecord[]
}

export async function completeMatchFull(formData: FormData) {
  const raw = formData.get('payload') as string | null
  if (!raw) return

  let payload: CompletePayload
  try { payload = JSON.parse(raw) } catch { return }

  const {
    matchId, homeScore, awayScore, homeWinnings, awayWinnings, events = [],
    playerUpdates = [], journeymanUpdates = [], mercUpdates = [], starUpdates = [], rosterStatRows = [],
  } = payload

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

  // Players who were already MNG coming into this match have now served their one-match suspension —
  // clear it unless this match itself just reinjured them (the only MNG left should be from this match).
  const newMngIds = new Set(playerUpdates.filter((u) => u.newStatus === 'MNG').map((u) => u.playerId))
  const staleMngPlayers = await prisma.teamPlayer.findMany({
    where:  { teamId: { in: [match.homeTeamId, match.awayTeamId] }, status: 'MNG' },
    select: { id: true },
  })
  const staleMngIds = staleMngPlayers.map((p) => p.id).filter((id) => !newMngIds.has(id))

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
    ...(staleMngIds.length > 0
      ? [prisma.teamPlayer.updateMany({ where: { id: { in: staleMngIds } }, data: { status: 'ACTIVE' } })]
      : []),
    ...journeymanUpdates.map((u) => prisma.matchJourneyman.update({
      where: { id: u.id },
      data: {
        touchdowns:     { increment: u.deltaTouchdowns },
        completePasses: { increment: u.deltaCompletePasses },
        interceptions:  { increment: u.deltaInterceptions },
        casualties:     { increment: u.deltaCasualties },
        mvp:            { increment: u.deltaMVP },
        ssp:            { increment: u.deltaSSP },
        injuryStatus:   u.injuryStatus,
      },
    })),
    // RAW: Mercenaries/Star Players only ever earn the MVP award — never skill up.
    ...mercUpdates.filter((u) => u.deltaMVP > 0).map((u) => prisma.matchMerc.update({
      where: { id: u.id },
      data:  { mvp: { increment: u.deltaMVP } },
    })),
    ...starUpdates.filter((u) => u.deltaMVP > 0).map((u) => prisma.matchStarPlayer.update({
      where: { id: u.id },
      data:  { mvp: { increment: u.deltaMVP } },
    })),
    // Per-match stat snapshot (distinct from the cumulative totals above), for match report / player history display.
    ...rosterStatRows.map((r) => prisma.matchPlayerStat.create({
      data: {
        matchId,
        teamPlayerId:   r.playerId,
        touchdowns:     r.touchdowns,
        completePasses: r.completePasses,
        interceptions:  r.interceptions,
        casualties:     r.casualties,
        mvp:            r.mvp,
        ssp:            r.ssp,
      },
    })),
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
    // Bulk-resolve MdMatchEvent IDs for known event types
    const uniqueTypes = [...new Set(events.map((e) => e.type).filter((t) => t in MD_EVENT_NAME))]
    const mdRows = uniqueTypes.length
      ? await prisma.mdMatchEvent.findMany({
          where: { name: { in: uniqueTypes.map((t) => MD_EVENT_NAME[t]) } },
          select: { id: true, name: true },
        })
      : []
    const mdByName = new Map(mdRows.map((r: { id: string; name: string }) => [r.name, r.id]))
    const getMdId = (type: string) => {
      const name = MD_EVENT_NAME[type]
      return name ? (mdByName.get(name) ?? null) : null
    }

    const base = Date.now()
    await prisma.$transaction([
      prisma.matchEvent.deleteMany({ where: { matchId } }),
      prisma.matchEvent.createMany({
        data: events.map((e, i) => ({
          matchId,
          type:          e.type,
          label:         e.label,
          mdMatchEventId: getMdId(e.type),
          createdAt:     new Date(base + i),   // 1 ms apart preserves order
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
