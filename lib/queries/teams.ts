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
              skillRollNormal: true, skillRollDouble: true,
              startingSkills: { select: { id: true, name: true, category: true, skillRule: true } },
            },
          },
          skillRolls:    { where: { consumed: false }, select: { id: true, die1: true, die2: true } },
          learnedSkills: { select: { id: true, name: true, category: true, skillRule: true } },
          _count:        { select: { skillRolls: true } },
          matchStats: {
            select: {
              id: true, touchdowns: true, completePasses: true, interceptions: true, casualties: true, mvp: true, ssp: true,
              match: { select: { id: true, round: true, homeScore: true, awayScore: true, homeTeam: { select: { id: true, name: true } }, awayTeam: { select: { id: true, name: true } } } },
            },
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { number: 'asc' },
      },
    },
  })
}

// All completed matches for a team, used to power per-player match history in the roster modal.
export async function getTeamCompletedMatches(teamId: string) {
  const [homeMatches, awayMatches] = await Promise.all([
    prisma.match.findMany({
      where:   { homeTeamId: teamId, status: 'COMPLETED' },
      select:  {
        id: true, round: true, homeScore: true, awayScore: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: { round: 'desc' },
    }),
    prisma.match.findMany({
      where:   { awayTeamId: teamId, status: 'COMPLETED' },
      select:  {
        id: true, round: true, homeScore: true, awayScore: true,
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: { round: 'desc' },
    }),
  ])
  return [...homeMatches, ...awayMatches].sort((a, b) => b.round - a.round)
}

// Journeymen hired by this team in now-completed matches, not yet signed or fired.
export async function getPendingJourneymen(teamId: string) {
  return prisma.matchJourneyman.findMany({
    where: {
      resolved: false,
      OR: [
        { side: 'home', match: { homeTeamId: teamId, status: 'COMPLETED' } },
        { side: 'away', match: { awayTeamId: teamId, status: 'COMPLETED' } },
      ],
    },
    include: {
      playerType: { select: { id: true, name: true, cost: true, ma: true, st: true, ag: true, av: true } },
      match: {
        select: {
          id: true, round: true,
          homeTeamId: true,
          awayTeamId: true,
          homeTeam: { select: { name: true } },
          awayTeam: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: 'desc' },
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
