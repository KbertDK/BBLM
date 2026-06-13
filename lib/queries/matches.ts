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
    where: { status: 'LIVE' },
    orderBy: { scheduledAt: 'asc' },
    include: matchInclude,
  })

  return matches.map((m) => ({
    id: m.id,
    round: m.round,
    homeTeamName: m.homeTeam.name,
    awayTeamName: m.awayTeam.name,
    scheduledAt: m.scheduledAt,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
  }))
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
