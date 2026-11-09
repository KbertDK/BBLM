import prisma from '@/lib/prisma'
import { computeTV } from '@/lib/teamValue'

export interface TeamStandingRow {
  id:     string
  name:   string
  tv:     number
  wins:   number
  losses: number
  draws:  number
  pts:    number
}

export interface PlayerStatRow {
  id:             string
  playerName:     string
  teamName:       string
  touchdowns:     number
  casualties:     number
  completePasses: number
  ssp:            number
}

export interface HomeStandings {
  teamRows:      TeamStandingRow[]
  topScorers:    PlayerStatRow[]
  topCasualties: PlayerStatRow[]
  topPassers:    PlayerStatRow[]
}

const EMPTY: HomeStandings = { teamRows: [], topScorers: [], topCasualties: [], topPassers: [] }

export async function getHomeStandings(leagueId?: string): Promise<HomeStandings> {
  const divisions = await prisma.division.findMany({
    where: {
      isHidden: false,
      season: {
        status: { in: ['READY', 'ACTIVE'] },
        ...(leagueId ? { leagueId } : {}),
      },
    },
    select: { id: true },
  })
  const divisionIds = divisions.map((d) => d.id)
  if (divisionIds.length === 0) return EMPTY

  const teams = await prisma.team.findMany({
    where:  { divisionId: { in: divisionIds } },
    select: {
      id: true, name: true, wins: true, losses: true, draws: true,
      rerolls: true, assistantCoaches: true, cheerleaders: true, fanFactor: true, apothecary: true,
      race:   { select: { rerollPrice: true } },
      league: { select: { ruleSet: { select: { pointsWin: true, pointsDraw: true, pointsLoss: true } } } },
      players: {
        where:  { status: 'ACTIVE' },
        select: { value: true, status: true, playerType: { select: { cost: true } } },
      },
    },
  })
  if (teams.length === 0) return EMPTY

  const teamRows: TeamStandingRow[] = teams
    .map((t) => {
      const pw = t.league.ruleSet?.pointsWin ?? 3
      const pd = t.league.ruleSet?.pointsDraw ?? 1
      const pl = t.league.ruleSet?.pointsLoss ?? 0
      return {
        id:     t.id,
        name:   t.name,
        tv:     computeTV(t),
        wins:   t.wins,
        losses: t.losses,
        draws:  t.draws,
        pts:    t.wins * pw + t.draws * pd + t.losses * pl,
      }
    })
    .sort((a, b) => b.pts - a.pts || b.tv - a.tv || a.name.localeCompare(b.name))

  const teamIds       = teams.map((t) => t.id)
  const teamNameById  = new Map(teams.map((t) => [t.id, t.name]))

  const playerSelect = {
    id: true, name: true, number: true,
    touchdowns: true, casualties: true, completePasses: true, ssp: true,
    teamId: true, playerType: { select: { name: true } },
  } as const

  const [byTd, byCas, byPass] = await Promise.all([
    prisma.teamPlayer.findMany({
      where: { teamId: { in: teamIds }, touchdowns: { gt: 0 } },
      orderBy: { touchdowns: 'desc' }, take: 10, select: playerSelect,
    }),
    prisma.teamPlayer.findMany({
      where: { teamId: { in: teamIds }, casualties: { gt: 0 } },
      orderBy: { casualties: 'desc' }, take: 10, select: playerSelect,
    }),
    prisma.teamPlayer.findMany({
      where: { teamId: { in: teamIds }, completePasses: { gt: 0 } },
      orderBy: { completePasses: 'desc' }, take: 10, select: playerSelect,
    }),
  ])

  function toRow(p: (typeof byTd)[number]): PlayerStatRow {
    return {
      id:             p.id,
      playerName:     p.name ?? `${p.playerType.name} #${p.number}`,
      teamName:       teamNameById.get(p.teamId) ?? '—',
      touchdowns:     p.touchdowns,
      casualties:     p.casualties,
      completePasses: p.completePasses,
      ssp:            p.ssp,
    }
  }

  return {
    teamRows,
    topScorers:    byTd.map(toRow),
    topCasualties: byCas.map(toRow),
    topPassers:    byPass.map(toRow),
  }
}
