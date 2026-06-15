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
  coachName:  string
  leagueName: string
  teamValue:  number
}

export async function getTeamById(id: string) {
  return prisma.team.findUnique({
    where: { id },
    include: {
      race:     { select: { name: true, rerollPrice: true, hasApothecary: true } },
      coach:    { select: { name: true, alias: true } },
      division: { select: { name: true } },
      league: {
        select: {
          name: true,
          ruleSet: { select: { numberOfPlayers: true } },
        },
      },
      players: {
        include: {
          playerType: {
            select: {
              name: true, ma: true, st: true, ag: true, av: true, cost: true,
              startingSkills: { select: { name: true, category: true, skillRule: true } },
            },
          },
        },
        orderBy: { number: 'asc' },
      },
    },
  })
}

export async function getLeagueTeams(): Promise<TeamListEntry[]> {
  const teams = await prisma.team.findMany({
    orderBy: [{ wins: 'desc' }, { draws: 'desc' }, { losses: 'asc' }],
    include: {
      race:    { select: { name: true, rerollPrice: true } },
      coach:   { select: { name: true, alias: true } },
      league:  { select: { name: true } },
      players: {
        where:  { status: { in: ['ACTIVE', 'MNG'] } },
        select: { value: true, playerType: { select: { cost: true } } },
      },
    },
  })
  return teams.map((t) => {
    const playerValue = t.players.reduce((s, p) => s + (p.value > 0 ? p.value : p.playerType.cost), 0)
    const teamValue   = Math.round(
      (playerValue
        + t.rerolls          * t.race.rerollPrice
        + t.assistantCoaches * 10000
        + t.cheerleaders     * 10000
        + t.fanFactor        * 10000
        + (t.apothecary      ? 50000 : 0)
      ) / 1000
    )
    return {
      ...mapTeam(t),
      coachName:  t.coach.alias ?? t.coach.name,
      leagueName: t.league.name,
      teamValue,
    }
  })
}
