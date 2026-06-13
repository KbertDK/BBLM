import prisma from '@/lib/prisma'
import { TeamSummary } from '@/lib/types'

function mapTeam(t: { id: string; name: string; race: { name: string }; wins: number; losses: number; draws: number }): TeamSummary {
  return { id: t.id, name: t.name, race: t.race.name, wins: t.wins, losses: t.losses, draws: t.draws }
}

const raceInclude = { race: { select: { name: true } } } as const

export async function getTeamsByCoach(coachId: string): Promise<TeamSummary[]> {
  const teams = await prisma.team.findMany({
    where: { coachId },
    orderBy: { createdAt: 'asc' },
    include: raceInclude,
  })
  return teams.map(mapTeam)
}

export async function getAllTeams(): Promise<TeamSummary[]> {
  const teams = await prisma.team.findMany({
    orderBy: { wins: 'desc' },
    include: raceInclude,
  })
  return teams.map(mapTeam)
}

export interface TeamListEntry extends TeamSummary {
  coachName: string
  leagueName: string
}

export async function getLeagueTeams(): Promise<TeamListEntry[]> {
  const teams = await prisma.team.findMany({
    orderBy: [{ wins: 'desc' }, { draws: 'desc' }, { losses: 'asc' }],
    include: {
      race:   { select: { name: true } },
      coach:  { select: { name: true } },
      league: { select: { name: true } },
    },
  })
  return teams.map((t) => ({
    ...mapTeam(t),
    coachName:  t.coach.name,
    leagueName: t.league.name,
  }))
}
