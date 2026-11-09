import prisma from '@/lib/prisma'

export interface ScopedMatch {
  id:            string
  homeTeamId:    string
  awayTeamId:    string
  homeScore:     number | null
  awayScore:     number | null
  homeTeamValue: number | null
  awayTeamValue: number | null
  scheduledAt:   Date | null
  createdAt:     Date
}

export interface TeamMatchRecord {
  wins:           number
  losses:         number
  draws:          number
  tdsScored:      number
  tdsConceded:    number
  lastTeamValue:  number | null
  matchResults:   { date: Date; result: 'W' | 'L' | 'D' }[]
  matchIds:       string[]
}

function emptyRecord(): TeamMatchRecord {
  return { wins: 0, losses: 0, draws: 0, tdsScored: 0, tdsConceded: 0, lastTeamValue: null, matchResults: [], matchIds: [] }
}

// One pass over a flat, season-scoped match list — derives each team's record from actual results
// rather than the lifetime Team.wins/losses/draws counters, which never reset between seasons.
export function buildTeamMatchRecords(matches: ScopedMatch[]): Map<string, TeamMatchRecord> {
  const records = new Map<string, TeamMatchRecord>()
  function ensure(teamId: string): TeamMatchRecord {
    let r = records.get(teamId)
    if (!r) { r = emptyRecord(); records.set(teamId, r) }
    return r
  }

  const sorted = [...matches].sort(
    (a, b) => (a.scheduledAt ?? a.createdAt).getTime() - (b.scheduledAt ?? b.createdAt).getTime()
  )

  for (const m of sorted) {
    const hs = m.homeScore ?? 0
    const as = m.awayScore ?? 0
    const date = m.scheduledAt ?? m.createdAt
    const home = ensure(m.homeTeamId)
    const away = ensure(m.awayTeamId)

    home.tdsScored += hs; home.tdsConceded += as
    away.tdsScored += as; away.tdsConceded += hs
    home.matchIds.push(m.id); away.matchIds.push(m.id)

    if (hs > as)      { home.wins++;  away.losses++; home.matchResults.push({ date, result: 'W' }); away.matchResults.push({ date, result: 'L' }) }
    else if (as > hs) { away.wins++;  home.losses++; away.matchResults.push({ date, result: 'W' }); home.matchResults.push({ date, result: 'L' }) }
    else              { home.draws++; away.draws++;  home.matchResults.push({ date, result: 'D' }); away.matchResults.push({ date, result: 'D' }) }

    if (m.homeTeamValue != null) home.lastTeamValue = m.homeTeamValue
    if (m.awayTeamValue != null) away.lastTeamValue = m.awayTeamValue
  }

  return records
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

export interface PlayerStatTotals {
  topScorers:    PlayerStatRow[]
  topCasualties: PlayerStatRow[]
  topPassers:    PlayerStatRow[]
}

const EMPTY_PLAYER_TOTALS: PlayerStatTotals = { topScorers: [], topCasualties: [], topPassers: [] }

// Sums MatchPlayerStat rows (per-match totals) across a season-scoped match-id list — never the
// lifetime TeamPlayer.touchdowns/casualties/completePasses/ssp counters, which never reset either.
export async function getPlayerStatTotals(
  matchIds: string[],
  teamNameById: Map<string, string>,
): Promise<PlayerStatTotals> {
  if (matchIds.length === 0) return EMPTY_PLAYER_TOTALS

  const grouped = await prisma.matchPlayerStat.groupBy({
    by:    ['teamPlayerId'],
    where: { matchId: { in: matchIds } },
    _sum:  { touchdowns: true, casualties: true, completePasses: true, ssp: true },
  })
  if (grouped.length === 0) return EMPTY_PLAYER_TOTALS

  const meta = await prisma.teamPlayer.findMany({
    where:  { id: { in: grouped.map((g) => g.teamPlayerId) } },
    select: { id: true, name: true, number: true, teamId: true, playerType: { select: { name: true } } },
  })
  const metaById = new Map(meta.map((m) => [m.id, m]))

  const rows: PlayerStatRow[] = grouped
    .map((g) => {
      const m = metaById.get(g.teamPlayerId)
      if (!m) return null
      return {
        id:             g.teamPlayerId,
        playerName:     m.name ?? `${m.playerType.name} #${m.number}`,
        teamName:       teamNameById.get(m.teamId) ?? '—',
        touchdowns:     g._sum.touchdowns ?? 0,
        casualties:     g._sum.casualties ?? 0,
        completePasses: g._sum.completePasses ?? 0,
        ssp:            g._sum.ssp ?? 0,
      }
    })
    .filter((r): r is PlayerStatRow => r !== null)

  return {
    topScorers:    rows.filter((r) => r.touchdowns > 0).sort((a, b) => b.touchdowns - a.touchdowns).slice(0, 10),
    topCasualties: rows.filter((r) => r.casualties > 0).sort((a, b) => b.casualties - a.casualties).slice(0, 10),
    topPassers:    rows.filter((r) => r.completePasses > 0).sort((a, b) => b.completePasses - a.completePasses).slice(0, 10),
  }
}
