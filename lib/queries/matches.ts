import prisma from '@/lib/prisma'
import { MatchSummary, MatchResult } from '@/lib/types'

const matchInclude = {
  homeTeam: { select: { id: true, name: true } },
  awayTeam: { select: { id: true, name: true } },
} as const

export async function getUpcomingMatches(): Promise<MatchSummary[]> {
  const matches = await prisma.match.findMany({
    where: { status: 'SCHEDULED' },
    orderBy: { scheduledAt: 'asc' },
    take: 5,
    include: matchInclude,
  })

  return matches.map((m) => ({
    id: m.id,
    round: m.round,
    homeTeamName: m.homeTeam.name,
    awayTeamName: m.awayTeam.name,
    scheduledAt: m.scheduledAt,
    homeScore: null,
    awayScore: null,
  }))
}

export async function getLiveMatches(): Promise<MatchSummary[]> {
  const matches = await prisma.match.findMany({
    where:   { status: 'LIVE' },
    orderBy: { scheduledAt: 'asc' },
    include: {
      ...matchInclude,
      events: {
        orderBy: { createdAt: 'desc' },
        select:  { id: true, type: true, label: true, scoringTeam: true },
      },
    },
  })

  return matches.map((m) => {
    const cas   = m.events.filter((e) => e.type === 'CASUALTY' && !e.label.endsWith('[KO]'))
    const kills = m.events.filter((e) => e.type === 'CASUALTY' && e.label.endsWith('[DEAD]'))
    return {
      id:            m.id,
      round:         m.round,
      homeTeamName:  m.homeTeam.name,
      awayTeamName:  m.awayTeam.name,
      scheduledAt:   m.scheduledAt,
      homeScore:     m.events.filter((e) => e.type === 'TD' && e.scoringTeam === 'home').length,
      awayScore:     m.events.filter((e) => e.type === 'TD' && e.scoringTeam === 'away').length,
      recentEvents:  m.events.slice(0, 3),
      allEvents:     [...m.events].reverse(), // chronological order for the ticker
      homeCasScore:  cas.filter((e)   => e.scoringTeam === 'home').length,
      awayCasScore:  cas.filter((e)   => e.scoringTeam === 'away').length,
      homeKillScore: kills.filter((e) => e.scoringTeam === 'home').length,
      awayKillScore: kills.filter((e) => e.scoringTeam === 'away').length,
    }
  })
}

export async function getMatchesByLeague(leagueId: string) {
  return prisma.match.findMany({
    where: { leagueId },
    include: {
      homeTeam: { select: { id: true, name: true, divisionId: true } },
      awayTeam: { select: { id: true, name: true, divisionId: true } },
    },
    orderBy: [{ round: 'asc' }, { scheduledAt: { sort: 'asc', nulls: 'last' } }],
  })
}

export async function getMatchReport(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId, status: 'COMPLETED' },
    include: {
      homeTeam: { select: { id: true, name: true, race: { select: { name: true } } } },
      awayTeam: { select: { id: true, name: true, race: { select: { name: true } } } },
      league:   { select: { name: true, season: true } },
      events:   { orderBy: { createdAt: 'asc' } },
    },
  })
}

export async function getLatestResults(): Promise<MatchResult[]> {
  const matches = await prisma.match.findMany({
    where: { status: 'COMPLETED' },
    orderBy: { scheduledAt: 'desc' },
    take: 5,
    include: matchInclude,
  })

  return matches.map((m) => {
    const hs = m.homeScore ?? 0
    const as_ = m.awayScore ?? 0
    let winnerId: string | null = null
    if (hs > as_) winnerId = m.homeTeam.id
    else if (as_ > hs) winnerId = m.awayTeam.id

    return {
      id: m.id,
      round: m.round,
      homeTeamName: m.homeTeam.name,
      awayTeamName: m.awayTeam.name,
      scheduledAt: m.scheduledAt,
      homeScore: hs,
      awayScore: as_,
      winnerId,
      homeTeamId: m.homeTeam.id,
      awayTeamId: m.awayTeam.id,
    }
  })
}
