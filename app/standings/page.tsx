import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import clsx from 'clsx'
import { parseTiebreakers } from '@/lib/tiebreakers'
import type { TiebreakerKey } from '@/lib/tiebreakers'
import { buildTeamMatchRecords } from '@/lib/teamSeasonStats'
import type { ScopedMatch, TeamMatchRecord } from '@/lib/teamSeasonStats'
import type { PlayerStatus, PrizeTargetType } from '@prisma/client'
import StandingsTableClient from './StandingsTableClient'
import type { TeamRowClient } from './StandingsTableClient'

export const revalidate = 60

type Props = { searchParams: Promise<{ leagueId?: string; seasonId?: string; divisionId?: string; season?: string }> }

const matchSelect = {
  id: true, seasonId: true, homeTeamId: true, awayTeamId: true,
  homeScore: true, awayScore: true,
  homeTeamValue: true, awayTeamValue: true,
  scheduledAt: true, createdAt: true,
} as const

interface TeamForRow {
  id: string
  name: string
  divisionId: string | null
  eloRating: number
  rerolls: number
  assistantCoaches: number
  cheerleaders: number
  fanFactor: number
  apothecary: boolean
  race: { name: string; rerollPrice: number }
  coach: { name: string; alias: string | null; eloRating: number }
  prizeAwards: { id: string }[]
  players: { value: number; playerType: { cost: number } }[]
}

// Shared row-builder: derives W/L/D/TV/streaks/casualties from match-scoped data (never the
// lifetime Team.wins/losses/draws counters, which never reset between seasons) for both the
// per-season blocks and the merged "All Closed" view.
function buildTeamRow(
  t: TeamForRow,
  record: TeamMatchRecord | undefined,
  matchCasByTeam: Map<string, Map<string, number>>,
  useLiveTV: boolean,
): TeamRowClient {
  const playerValue = t.players.reduce((s, p) => s + (p.value > 0 ? p.value : p.playerType.cost), 0)
  const liveTV = Math.round(
    (playerValue
      + t.rerolls          * t.race.rerollPrice
      + t.assistantCoaches * 10000
      + t.cheerleaders     * 10000
      + t.fanFactor        * 10000
      + (t.apothecary      ? 50000 : 0)
    ) / 1000
  )
  const teamValue = useLiveTV ? liveTV : (record?.lastTeamValue ?? liveTV)

  let tcasf = 0, tcasa = 0
  for (const matchId of record?.matchIds ?? []) {
    const byTeam   = matchCasByTeam.get(matchId)
    const myCas    = byTeam?.get(t.id) ?? 0
    const totalCas = [...(byTeam?.values() ?? [])].reduce((a, b) => a + b, 0)
    tcasf += myCas
    tcasa += totalCas - myCas
  }

  let sw = 0, sl = 0, sd = 0, cw = 0, cl = 0, cd = 0
  for (const { result } of record?.matchResults ?? []) {
    if (result === 'W') { cw++; cl = 0; cd = 0; sw = Math.max(sw, cw) }
    else if (result === 'L') { cl++; cw = 0; cd = 0; sl = Math.max(sl, cl) }
    else { cd++; cw = 0; cl = 0; sd = Math.max(sd, cd) }
  }

  return {
    id:             t.id,
    name:           t.name,
    race:           t.race.name,
    coachName:      t.coach.alias ?? t.coach.name,
    wins:           record?.wins   ?? 0,
    draws:          record?.draws  ?? 0,
    losses:         record?.losses ?? 0,
    teamValue,
    divisionId:     t.divisionId,
    eloRating:      t.eloRating,
    coachEloRating: t.coach.eloRating,
    tdsScored:      record?.tdsScored   ?? 0,
    tdsConceded:    record?.tdsConceded ?? 0,
    tdsDiff:        (record?.tdsScored ?? 0) - (record?.tdsConceded ?? 0),
    streakWin:      sw,
    streakLoss:     sl,
    streakDraw:     sd,
    wonPrizes:      t.prizeAwards.length,
    tcasf,
    tcasa,
  }
}

async function buildCasByTeam(matchIds: string[]): Promise<Map<string, Map<string, number>>> {
  const casStats = matchIds.length > 0
    ? await prisma.matchPlayerStat.findMany({
        where:  { matchId: { in: matchIds } },
        select: { matchId: true, casualties: true, teamPlayer: { select: { teamId: true } } },
      })
    : []
  const matchCasByTeam = new Map<string, Map<string, number>>()
  for (const s of casStats) {
    if (!matchCasByTeam.has(s.matchId)) matchCasByTeam.set(s.matchId, new Map())
    const m = matchCasByTeam.get(s.matchId)!
    m.set(s.teamPlayer.teamId, (m.get(s.teamPlayer.teamId) ?? 0) + s.casualties)
  }
  return matchCasByTeam
}

const teamRowInclude = {
  race:    { select: { name: true, rerollPrice: true } },
  coach:   { select: { name: true, alias: true, eloRating: true } },
  prizeAwards: { where: { prizeType: { type: 'TEAM' as PrizeTargetType } }, select: { id: true } },
  players: {
    where:  { status: { in: ['ACTIVE', 'MNG'] as PlayerStatus[] } },
    select: { value: true, playerType: { select: { cost: true } } },
  },
}

const SEASON_STATUS_CLS: Record<string, string> = {
  PLANNING: 'text-bb-muted border-bb-muted/30 bg-bb-muted/5',
  ACTIVE:   'text-bb-gold border-bb-gold/40 bg-bb-gold/5',
  READY:    'text-green-400 border-green-700/50 bg-green-900/10',
  ENDED:    'text-bb-muted border-bb-muted/30 bg-bb-muted/5',
}
const SEASON_STATUS_LABEL: Record<string, string> = {
  PLANNING: 'Planning',
  ACTIVE:   'Active',
  READY:    'Ready',
  ENDED:    'Ended',
}

function sortTeams(
  teams: TeamRowClient[],
  pw: number, pd: number, pl: number,
  tiebreakers: TiebreakerKey[],
): TeamRowClient[] {
  return [...teams].sort((a, b) => {
    const ptsA = a.wins * pw + a.draws * pd + a.losses * pl
    const ptsB = b.wins * pw + b.draws * pd + b.losses * pl
    if (ptsB !== ptsA) return ptsB - ptsA

    for (const tb of tiebreakers) {
      let diff = 0
      if (tb === 'WINS')        diff = b.wins - a.wins
      if (tb === 'DRAWS')       diff = b.draws - a.draws
      if (tb === 'LOSSES')      diff = a.losses - b.losses
      if (tb === 'PTS')         diff = (b.wins * pw + b.draws * pd + b.losses * pl) - (a.wins * pw + a.draws * pd + a.losses * pl)
      if (tb === 'TD_SCORED')   diff = b.tdsScored - a.tdsScored
      if (tb === 'TD_CONCEDED') diff = a.tdsConceded - b.tdsConceded
      if (tb === 'TD_DIFF')     diff = b.tdsDiff - a.tdsDiff
      if (tb === 'TCASF')       diff = b.tcasf - a.tcasf
      if (tb === 'TCASA')       diff = a.tcasa - b.tcasa
      if (tb === 'TCDIFF')      diff = (b.tcasf - b.tcasa) - (a.tcasf - a.tcasa)
      if (diff !== 0) return diff
    }
    return 0
  })
}

interface TournamentGroup {
  id: string
  name: string
  teams: TeamRowClient[]
}

interface SeasonBlock {
  seasonId:     string
  seasonName:   string
  leagueId:     string
  leagueName:   string
  season:       number
  status:       string
  pointsWin:    number
  pointsDraw:   number
  pointsLoss:   number
  tiebreakers:  TiebreakerKey[]
  tournamentGroups: TournamentGroup[]
  ungroupedTeams:   TeamRowClient[]
}

function StandingsTable({ block }: { block: SeasonBlock }) {
  const { pointsWin, pointsDraw, pointsLoss, tiebreakers, tournamentGroups, ungroupedTeams } = block
  const hasGroups = tournamentGroups.length > 0

  return (
    <div className="flex flex-col gap-4">
      {tournamentGroups.map((group) => {
        const sorted = sortTeams(group.teams, pointsWin, pointsDraw, pointsLoss, tiebreakers)
        return (
          <div key={group.id}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-heading tracking-widest uppercase text-bb-gold/70">{group.name}</span>
              <div className="flex-1 h-px bg-bb-border/60" />
            </div>
            <StandingsTableClient
              teams={sorted}
              pointsWin={pointsWin}
              pointsDraw={pointsDraw}
              pointsLoss={pointsLoss}
            />
            <p className="text-[10px] text-bb-muted/40 mt-1.5 text-right font-heading tracking-wide">
              W={pointsWin} · D={pointsDraw} · L={pointsLoss} pts
            </p>
          </div>
        )
      })}

      {ungroupedTeams.length > 0 && (
        <div>
          {hasGroups && (
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-heading tracking-widest uppercase text-bb-muted/50">Other</span>
              <div className="flex-1 h-px bg-bb-border/60" />
            </div>
          )}
          <StandingsTableClient
            teams={sortTeams(ungroupedTeams, pointsWin, pointsDraw, pointsLoss, tiebreakers)}
            pointsWin={pointsWin}
            pointsDraw={pointsDraw}
            pointsLoss={pointsLoss}
          />
          <p className="text-[10px] text-bb-muted/40 mt-1.5 text-right font-heading tracking-wide">
            W={pointsWin} · D={pointsDraw} · L={pointsLoss} pts
          </p>
        </div>
      )}
    </div>
  )
}

interface ClosedLeagueBlock {
  leagueId:   string
  leagueName: string
  pointsWin:  number
  pointsDraw: number
  pointsLoss: number
  rows:       TeamRowClient[]
}

export default async function StandingsPage({ searchParams }: Props) {
  const { leagueId, seasonId, divisionId, season } = await searchParams
  const isClosedMode = season === 'closed'

  // Default to the user's primary league when no league is selected
  if (!leagueId) {
    const session = await getSession()
    if (session?.coachId) {
      const coach = await prisma.coach.findUnique({
        where:  { id: session.coachId },
        select: { primaryLeagueId: true },
      })
      if (coach?.primaryLeagueId) {
        redirect(`/standings?leagueId=${coach.primaryLeagueId}`)
      }
    }
  }

  // Load all leagues (for the filter pill list + tiebreaker config)
  const allLeagues = await prisma.league.findMany({
    where:   { isHidden: false },
    orderBy: { name: 'asc' },
    select:  {
      id: true, name: true,
      standingsTiebreakers: true,
      ruleSet: { select: { pointsWin: true, pointsDraw: true, pointsLoss: true } },
      seasons: {
        select: { id: true, name: true, season: true, status: true },
        orderBy: { season: 'desc' },
      },
    },
  })

  // All seasons across all leagues (flat list for standings)
  const allSeasons = allLeagues.flatMap((l) =>
    l.seasons.map((s) => ({ ...s, leagueId: l.id, leagueName: l.name, ruleSet: l.ruleSet }))
  )

  const activeSeasons = allSeasons.filter((s) => s.status === 'ACTIVE' || s.status === 'READY')
  const endedSeasons  = allSeasons.filter((s) => s.status === 'ENDED')

  // Seasons to display
  const targetSeasons = seasonId
    ? allSeasons.filter((s) => s.id === seasonId)
    : leagueId
    ? activeSeasons.filter((s) => s.leagueId === leagueId)
    : activeSeasons

  let selectedLeagueDivisions: { id: string; name: string; seasonId: string }[] = []
  let seasonBlocks:  SeasonBlock[] = []
  let closedBlocks:  ClosedLeagueBlock[] = []

  if (!isClosedMode) {
    const targetSeasonIds = targetSeasons.map((s) => s.id)
    const targetLeagueIds = [...new Set(targetSeasons.map((s) => s.leagueId))]

    // Divisions for the selected season/league — for the division filter pills
    selectedLeagueDivisions = (leagueId || seasonId)
      ? await prisma.division.findMany({
          where: {
            isHidden: false,
            ...(seasonId ? { seasonId } : { season: { leagueId } }),
          },
          orderBy: { name: 'asc' },
          select:  { id: true, name: true, seasonId: true },
        })
      : []

    // One flat, season-scoped match query — replaces per-team relational fetches, and is the
    // single source of truth for W/L/D/TV/streaks (never the lifetime Team.wins/draws/losses).
    const matches = targetSeasonIds.length > 0
      ? await prisma.match.findMany({
          where:  { status: 'COMPLETED', seasonId: { in: targetSeasonIds } },
          select: matchSelect,
        })
      : []

    const matchesBySeasonId = new Map<string, ScopedMatch[]>()
    for (const m of matches) {
      const sid = m.seasonId as string
      if (!matchesBySeasonId.has(sid)) matchesBySeasonId.set(sid, [])
      matchesBySeasonId.get(sid)!.push(m)
    }
    const recordsBySeasonId = new Map<string, Map<string, TeamMatchRecord>>()
    for (const [sid, ms] of matchesBySeasonId) recordsBySeasonId.set(sid, buildTeamMatchRecords(ms))

    // For active/ready seasons, also include teams currently assigned to one of their divisions
    // even if they haven't played a match yet — a past season's roster can only come from matches
    // (divisionId is live/current, not historical, so it can't reconstruct who played in it).
    const activeTargetSeasonIds = targetSeasons.filter((s) => s.status === 'ACTIVE' || s.status === 'READY').map((s) => s.id)
    const divisionsForActive = activeTargetSeasonIds.length > 0
      ? await prisma.division.findMany({ where: { seasonId: { in: activeTargetSeasonIds } }, select: { id: true, seasonId: true } })
      : []
    const currentTeamsByDivision = divisionsForActive.length > 0
      ? await prisma.team.findMany({ where: { divisionId: { in: divisionsForActive.map((d) => d.id) } }, select: { id: true, divisionId: true } })
      : []
    const divisionIdToSeasonId = new Map(divisionsForActive.map((d) => [d.id, d.seasonId]))

    const teamIdsBySeasonId = new Map<string, Set<string>>()
    for (const s of targetSeasons) teamIdsBySeasonId.set(s.id, new Set(recordsBySeasonId.get(s.id)?.keys() ?? []))
    for (const t of currentTeamsByDivision) {
      const sid = t.divisionId ? divisionIdToSeasonId.get(t.divisionId) : undefined
      if (sid && teamIdsBySeasonId.has(sid)) teamIdsBySeasonId.get(sid)!.add(t.id)
    }

    const allNeededTeamIds = [...new Set([...teamIdsBySeasonId.values()].flatMap((s) => [...s]))]
    const teams = allNeededTeamIds.length > 0
      ? await prisma.team.findMany({
          where:   { id: { in: allNeededTeamIds }, ...(divisionId ? { divisionId } : {}) },
          include: teamRowInclude,
        })
      : []
    const teamsById = new Map(teams.map((t) => [t.id, t]))

    const matchCasByTeam = await buildCasByTeam(matches.map((m) => m.id))

    // Tournaments linked to divisions in target seasons
    const tournaments = await prisma.tournament.findMany({
      where:   { divisions: { some: { season: { leagueId: { in: targetLeagueIds } } } } },
      include: { divisions: { select: { id: true, seasonId: true } } },
      orderBy: { name: 'asc' },
    })

    seasonBlocks = targetSeasons.map((season) => {
      const league = allLeagues.find((l) => l.id === season.leagueId)!
      const tiebreakers = parseTiebreakers(league.standingsTiebreakers)
      const useLiveTV = season.status === 'ACTIVE' || season.status === 'READY'
      const records = recordsBySeasonId.get(season.id)
      const teamIdSet = teamIdsBySeasonId.get(season.id) ?? new Set<string>()

      const seasonTeams: TeamRowClient[] = [...teamIdSet]
        .map((id) => teamsById.get(id))
        .filter((t): t is NonNullable<typeof t> => !!t)
        .map((t) => buildTeamRow(t, records?.get(t.id), matchCasByTeam, useLiveTV))

      const seasonTournaments = tournaments.filter(
        (t) => t.divisions.some((d) => d.seasonId === season.id)
      )

      const tournamentGroups: TournamentGroup[] = seasonTournaments.map((tournament) => {
        const divisionIds = new Set(
          tournament.divisions
            .filter((d) => d.seasonId === season.id)
            .map((d) => d.id)
        )
        return {
          id:    tournament.id,
          name:  tournament.name,
          teams: seasonTeams.filter((t) => t.divisionId != null && divisionIds.has(t.divisionId)),
        }
      })

      const assignedIds    = new Set(tournamentGroups.flatMap((g) => g.teams.map((t) => t.id)))
      const ungroupedTeams = seasonTeams.filter((t) => !assignedIds.has(t.id))

      return {
        seasonId:   season.id,
        seasonName: season.name,
        leagueId:   season.leagueId,
        leagueName: season.leagueName,
        season:     season.season,
        status:     season.status,
        pointsWin:  league.ruleSet?.pointsWin  ?? 3,
        pointsDraw: league.ruleSet?.pointsDraw ?? 1,
        pointsLoss: league.ruleSet?.pointsLoss ?? 0,
        tiebreakers,
        tournamentGroups,
        ungroupedTeams,
      }
    })
  } else {
    // "All Closed" — one merged, flat block per league that has at least one ENDED season in scope.
    const leagueIdsInScope = leagueId ? [leagueId] : allLeagues.map((l) => l.id)
    for (const lid of leagueIdsInScope) {
      const league = allLeagues.find((l) => l.id === lid)
      if (!league) continue
      const closedSeasonIds = league.seasons.filter((s) => s.status === 'ENDED').map((s) => s.id)
      if (closedSeasonIds.length === 0) continue

      const matches = await prisma.match.findMany({
        where:  { status: 'COMPLETED', seasonId: { in: closedSeasonIds } },
        select: matchSelect,
      })
      if (matches.length === 0) continue

      const records = buildTeamMatchRecords(matches)
      const teamIds = [...records.keys()]
      const teams = await prisma.team.findMany({ where: { id: { in: teamIds } }, include: teamRowInclude })
      const matchCasByTeam = await buildCasByTeam(matches.map((m) => m.id))
      const tiebreakers = parseTiebreakers(league.standingsTiebreakers)
      const pointsWin  = league.ruleSet?.pointsWin  ?? 3
      const pointsDraw = league.ruleSet?.pointsDraw ?? 1
      const pointsLoss = league.ruleSet?.pointsLoss ?? 0

      const rows = teams.map((t) => buildTeamRow(t, records.get(t.id), matchCasByTeam, false))
      const sorted = sortTeams(rows, pointsWin, pointsDraw, pointsLoss, tiebreakers)

      closedBlocks.push({ leagueId: lid, leagueName: league.name, pointsWin, pointsDraw, pointsLoss, rows: sorted })
    }
  }

  const selectedLeague = leagueId ? allLeagues.find((l) => l.id === leagueId) : null

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Page heading */}
        <div className="text-center mb-10">
          <div className="flex items-center gap-4 justify-center mb-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-bb-gold/60 max-w-32" />
            <h1 className="font-heading text-3xl font-bold text-bb-gold tracking-widest uppercase">
              Standings
            </h1>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-bb-gold/60 max-w-32" />
          </div>
          <p className="text-bb-muted text-sm tracking-wide mt-1">
            {selectedLeague ? selectedLeague.name : 'All ongoing leagues'}
          </p>
        </div>

        {/* ── League filter pills ────────────────────────────────────── */}
        {allLeagues.length > 0 && (
          <div className="mb-4">
            {(activeSeasons.length > 0 || endedSeasons.length > 0) && (
              <div className="mb-3">
                <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">League</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/standings"
                    className={clsx(
                      'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                      !leagueId && !isClosedMode
                        ? 'bg-bb-gold text-bb-navy border-bb-gold font-bold'
                        : 'border-bb-border text-bb-muted hover:border-bb-gold/40 hover:text-bb-gold',
                    )}
                  >
                    All Active
                  </Link>
                  {allLeagues
                    .filter((l) => l.seasons.some((s) => s.status === 'ACTIVE' || s.status === 'READY'))
                    .map((l) => (
                      <Link
                        key={l.id}
                        href={`/standings?leagueId=${l.id}`}
                        className={clsx(
                          'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                          leagueId === l.id && !isClosedMode
                            ? 'bg-bb-gold text-bb-navy border-bb-gold font-bold'
                            : 'border-bb-border text-bb-muted hover:border-bb-gold/40 hover:text-bb-gold',
                        )}
                      >
                        {l.name}
                        {l.seasons.some((s) => s.status === 'ACTIVE') && (
                          <span className="ml-1.5 text-[10px] text-bb-crimson-bright">●</span>
                        )}
                      </Link>
                    ))}
                  {endedSeasons.length > 0 && (
                    <Link
                      href={leagueId ? `/standings?leagueId=${leagueId}&season=closed` : '/standings?season=closed'}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                        isClosedMode
                          ? 'bg-bb-muted/20 text-white border-bb-muted/60 font-bold'
                          : 'border-bb-border/50 text-bb-muted/60 hover:border-bb-muted/50 hover:text-bb-muted',
                      )}
                    >
                      All Closed
                    </Link>
                  )}
                </div>
              </div>
            )}

            {!isClosedMode && endedSeasons.length > 0 && !leagueId && (
              <div>
                <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Past Seasons</p>
                <div className="flex flex-wrap gap-2">
                  {endedSeasons.map((s) => (
                    <Link
                      key={s.id}
                      href={`/standings?leagueId=${s.leagueId}&seasonId=${s.id}`}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                        seasonId === s.id
                          ? 'bg-bb-muted/20 text-white border-bb-muted/60 font-bold'
                          : 'border-bb-border/50 text-bb-muted/60 hover:border-bb-muted/50 hover:text-bb-muted',
                      )}
                    >
                      {s.leagueName} · {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Season picker within a selected league */}
            {!isClosedMode && leagueId && selectedLeague && selectedLeague.seasons.length > 1 && (
              <div className="mt-3">
                <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Season</p>
                <div className="flex flex-wrap gap-2">
                  {selectedLeague.seasons.filter((s) => s.status !== 'PLANNING').map((s) => (
                    <Link
                      key={s.id}
                      href={`/standings?leagueId=${leagueId}&seasonId=${s.id}`}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                        seasonId === s.id
                          ? 'bg-bb-gold/20 text-bb-gold border-bb-gold/50 font-bold'
                          : 'border-bb-border/50 text-bb-muted hover:border-bb-gold/30 hover:text-bb-gold/70',
                      )}
                    >
                      {s.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Division filter — shown when a league/season is selected ─────── */}
        {!isClosedMode && (leagueId || seasonId) && selectedLeagueDivisions.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Division</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={seasonId ? `/standings?leagueId=${leagueId}&seasonId=${seasonId}` : `/standings?leagueId=${leagueId}`}
                className={clsx(
                  'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                  !divisionId
                    ? 'bg-bb-gold/20 text-bb-gold border-bb-gold/50 font-bold'
                    : 'border-bb-border/50 text-bb-muted hover:border-bb-gold/30 hover:text-bb-gold/70',
                )}
              >
                All Divisions
              </Link>
              {selectedLeagueDivisions.map((d) => (
                <Link
                  key={d.id}
                  href={seasonId
                    ? `/standings?leagueId=${leagueId}&seasonId=${seasonId}&divisionId=${d.id}`
                    : `/standings?leagueId=${leagueId}&divisionId=${d.id}`}
                  className={clsx(
                    'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                    divisionId === d.id
                      ? 'bg-bb-gold/20 text-bb-gold border-bb-gold/50 font-bold'
                      : 'border-bb-border/50 text-bb-muted hover:border-bb-gold/30 hover:text-bb-gold/70',
                  )}
                >
                  {d.name}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── No leagues at all ──────────────────────────────────────── */}
        {allLeagues.length === 0 && (
          <div className="bg-bb-dark border border-bb-border rounded-sm p-10 text-center">
            <p className="text-bb-muted text-sm italic">No leagues have been created yet.</p>
          </div>
        )}

        {/* ── No active seasons, nothing selected ───────────────────── */}
        {!isClosedMode && !leagueId && !seasonId && activeSeasons.length === 0 && allLeagues.length > 0 && (
          <div className="bg-bb-dark border border-bb-border rounded-sm p-8 text-center mb-8">
            <p className="text-bb-muted text-sm">No active seasons right now.</p>
            <p className="text-bb-muted/50 text-xs mt-1">Select a past season above to view its standings.</p>
          </div>
        )}

        {/* ── Standings blocks ───────────────────────────────────────── */}
        {!isClosedMode ? (
          <div className="flex flex-col gap-10">
            {seasonBlocks.map((block) => (
              <section key={block.seasonId}>
                {(seasonBlocks.length > 1 || leagueId || seasonId) && (
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-xl font-bold text-white tracking-wide">
                        {block.leagueName}
                        {seasonBlocks.length > 1 && (
                          <span className="text-bb-muted/60 font-normal text-base ml-2">· {block.seasonName}</span>
                        )}
                      </h2>
                      <span className={clsx(
                        'text-[10px] font-heading tracking-wider uppercase px-1.5 py-0.5 rounded-sm border',
                        SEASON_STATUS_CLS[block.status],
                      )}>
                        {SEASON_STATUS_LABEL[block.status]}
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-bb-border ml-2" />
                    <Link
                      href={`/standings?leagueId=${block.leagueId}&seasonId=${block.seasonId}`}
                      className="text-xs text-bb-muted hover:text-bb-gold transition-colors font-heading tracking-wide uppercase shrink-0"
                    >
                      Full view →
                    </Link>
                  </div>
                )}

                {block.tournamentGroups.length === 0 && block.ungroupedTeams.length === 0 ? (
                  <div className="bg-bb-dark border border-bb-border rounded-sm p-6 text-center">
                    <p className="text-bb-muted/50 text-sm italic">No teams assigned to this season yet.</p>
                  </div>
                ) : (
                  <StandingsTable block={block} />
                )}
              </section>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-10">
            {closedBlocks.length === 0 ? (
              <div className="bg-bb-dark border border-bb-border rounded-sm p-8 text-center mb-8">
                <p className="text-bb-muted text-sm">No closed seasons yet.</p>
              </div>
            ) : (
              closedBlocks.map((block) => (
                <section key={block.leagueId}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-xl font-bold text-white tracking-wide">{block.leagueName}</h2>
                      <span className="text-[10px] font-heading tracking-wider uppercase px-1.5 py-0.5 rounded-sm border text-bb-muted border-bb-muted/30 bg-bb-muted/5">
                        All Closed Seasons
                      </span>
                    </div>
                    <div className="flex-1 h-px bg-bb-border ml-2" />
                  </div>
                  <StandingsTableClient
                    teams={block.rows}
                    pointsWin={block.pointsWin}
                    pointsDraw={block.pointsDraw}
                    pointsLoss={block.pointsLoss}
                  />
                  <p className="text-[10px] text-bb-muted/40 mt-1.5 text-right font-heading tracking-wide">
                    W={block.pointsWin} · D={block.pointsDraw} · L={block.pointsLoss} pts
                  </p>
                </section>
              ))
            )}
          </div>
        )}

        {/* ── Past seasons cards (default view only) ────────────────── */}
        {!isClosedMode && !leagueId && !seasonId && endedSeasons.length > 0 && (
          <div className="mt-14">
            <div className="flex items-center gap-4 mb-5">
              <h2 className="font-heading text-sm font-bold text-bb-muted/60 tracking-widest uppercase whitespace-nowrap">
                Past Seasons
              </h2>
              <div className="flex-1 h-px bg-bb-border/50" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {endedSeasons.map((s) => (
                <Link
                  key={s.id}
                  href={`/standings?leagueId=${s.leagueId}&seasonId=${s.id}`}
                  className="flex items-center justify-between px-4 py-3 bg-bb-dark border border-bb-border/50 rounded-sm hover:border-bb-muted/40 hover:bg-bb-darker/60 transition-colors group"
                >
                  <div>
                    <p className="font-heading font-bold text-bb-muted/80 group-hover:text-white text-sm transition-colors leading-tight">
                      {s.leagueName}
                    </p>
                    <p className="text-xs text-bb-muted/50 mt-0.5">{s.name}</p>
                  </div>
                  <span className="text-bb-muted/30 group-hover:text-bb-muted transition-colors text-sm">→</span>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
