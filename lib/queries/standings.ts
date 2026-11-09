import prisma from '@/lib/prisma'
import { computeTV } from '@/lib/teamValue'
import { resolveSeasonIds, type SeasonMode } from '@/lib/seasonFilter'
import { buildTeamMatchRecords, getPlayerStatTotals, type PlayerStatRow, type ScopedMatch } from '@/lib/teamSeasonStats'

export type { PlayerStatRow }

export interface TeamStandingRow {
  id:     string
  name:   string
  tv:     number
  wins:   number
  losses: number
  draws:  number
  pts:    number
}

export interface HomeStandings {
  teamRows:      TeamStandingRow[]
  topScorers:    PlayerStatRow[]
  topCasualties: PlayerStatRow[]
  topPassers:    PlayerStatRow[]
}

const EMPTY: HomeStandings = { teamRows: [], topScorers: [], topCasualties: [], topPassers: [] }

const matchSelect = {
  id: true, homeTeamId: true, awayTeamId: true,
  homeScore: true, awayScore: true,
  homeTeamValue: true, awayTeamValue: true,
  scheduledAt: true, createdAt: true,
} as const

export async function getHomeStandings(leagueId: string | undefined, mode: SeasonMode): Promise<HomeStandings> {
  const seasonIds = await resolveSeasonIds(leagueId, mode)
  if (seasonIds.length === 0) return EMPTY

  const matches: ScopedMatch[] = await prisma.match.findMany({
    where:  { status: 'COMPLETED', seasonId: { in: seasonIds } },
    select: matchSelect,
  })

  const records = buildTeamMatchRecords(matches)
  const teamIds = new Set(records.keys())

  if (mode.kind === 'active') {
    const divisions = await prisma.division.findMany({
      where:  { isHidden: false, season: { status: { in: ['READY', 'ACTIVE'] }, ...(leagueId ? { leagueId } : {}) } },
      select: { id: true },
    })
    const currentTeams = await prisma.team.findMany({
      where:  { divisionId: { in: divisions.map((d) => d.id) } },
      select: { id: true },
    })
    currentTeams.forEach((t) => teamIds.add(t.id))
  }

  if (teamIds.size === 0) return EMPTY

  const teams = await prisma.team.findMany({
    where:  { id: { in: [...teamIds] } },
    select: {
      id: true, name: true,
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
      const rec = records.get(t.id)
      const pw = t.league.ruleSet?.pointsWin  ?? 3
      const pd = t.league.ruleSet?.pointsDraw ?? 1
      const pl = t.league.ruleSet?.pointsLoss ?? 0
      const wins   = rec?.wins   ?? 0
      const losses = rec?.losses ?? 0
      const draws  = rec?.draws  ?? 0
      const tv = mode.kind === 'active' ? computeTV(t) : (rec?.lastTeamValue ?? computeTV(t))
      return {
        id: t.id, name: t.name, tv,
        wins, losses, draws,
        pts: wins * pw + draws * pd + losses * pl,
      }
    })
    .sort((a, b) => b.pts - a.pts || b.tv - a.tv || a.name.localeCompare(b.name))

  const teamNameById = new Map(teams.map((t) => [t.id, t.name]))
  const { topScorers, topCasualties, topPassers } = await getPlayerStatTotals(
    matches.map((m) => m.id),
    teamNameById,
  )

  return { teamRows, topScorers, topCasualties, topPassers }
}
