import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import clsx from 'clsx'
import { parseTiebreakers } from '@/lib/tiebreakers'
import type { TiebreakerKey } from '@/lib/tiebreakers'
import StandingsTableClient from './StandingsTableClient'
import type { TeamRowClient } from './StandingsTableClient'

export const revalidate = 60

type Props = { searchParams: Promise<{ leagueId?: string; seasonId?: string; divisionId?: string }> }

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
      if (tb === 'WINS')      diff = b.wins - a.wins
      if (tb === 'DRAWS')     diff = b.draws - a.draws
      if (tb === 'LOSSES')    diff = a.losses - b.losses
      if (tb === 'TD_DIFF')   diff = b.tdsDiff - a.tdsDiff
      if (tb === 'TD_SCORED') diff = b.tdsScored - a.tdsScored
      if (tb === 'ELO')       diff = b.eloRating - a.eloRating
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

export default async function StandingsPage({ searchParams }: Props) {
  const { leagueId, seasonId, divisionId } = await searchParams

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

  // Divisions for the selected season/league — for the division filter pills
  const selectedLeagueDivisions = (leagueId || seasonId)
    ? await prisma.division.findMany({
        where: {
          isHidden: false,
          ...(seasonId ? { seasonId } : { season: { leagueId } }),
        },
        orderBy: { name: 'asc' },
        select:  { id: true, name: true, seasonId: true },
      })
    : []

  const targetSeasonIds = targetSeasons.map((s) => s.id)
  const targetLeagueIds = [...new Set(targetSeasons.map((s) => s.leagueId))]

  // Teams in these leagues (scoped by divisionId filter if set)
  const teams = await prisma.team.findMany({
    where: {
      leagueId: { in: targetLeagueIds },
      ...(divisionId ? { divisionId } : {}),
    },
    include: {
      race:    { select: { name: true, rerollPrice: true } },
      coach:   { select: { name: true, alias: true } },
      players: {
        where:  { status: { in: ['ACTIVE', 'MNG'] } },
        select: { value: true, playerType: { select: { cost: true } } },
      },
      homeMatches: {
        where:  { status: 'COMPLETED', ...(targetSeasonIds.length > 0 ? { seasonId: { in: targetSeasonIds } } : {}) },
        select: { homeScore: true, awayScore: true },
      },
      awayMatches: {
        where:  { status: 'COMPLETED', ...(targetSeasonIds.length > 0 ? { seasonId: { in: targetSeasonIds } } : {}) },
        select: { homeScore: true, awayScore: true },
      },
    },
    orderBy: { name: 'asc' },
  })

  // Tournaments linked to divisions in target seasons
  const tournaments = await prisma.tournament.findMany({
    where:   { divisions: { some: { season: { leagueId: { in: targetLeagueIds } } } } },
    include: { divisions: { select: { id: true, seasonId: true } } },
    orderBy: { name: 'asc' },
  })

  const seasonBlocks: SeasonBlock[] = targetSeasons.map((season) => {
    const league = allLeagues.find((l) => l.id === season.leagueId)!
    const tiebreakers = parseTiebreakers(league.standingsTiebreakers)

    const seasonTeams: TeamRowClient[] = teams
      .filter((t) => t.leagueId === season.leagueId)
      .map((t) => {
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

        const tdsScored   = t.homeMatches.reduce((s, m) => s + (m.homeScore ?? 0), 0)
                          + t.awayMatches.reduce((s, m) => s + (m.awayScore ?? 0), 0)
        const tdsConceded = t.homeMatches.reduce((s, m) => s + (m.awayScore ?? 0), 0)
                          + t.awayMatches.reduce((s, m) => s + (m.homeScore ?? 0), 0)

        return {
          id:          t.id,
          name:        t.name,
          race:        t.race.name,
          coachName:   t.coach.alias ?? t.coach.name,
          wins:        t.wins,
          draws:       t.draws,
          losses:      t.losses,
          teamValue,
          divisionId:  t.divisionId,
          eloRating:   t.eloRating,
          tdsScored,
          tdsConceded,
          tdsDiff:     tdsScored - tdsConceded,
        }
      })

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
            {activeSeasons.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">League</p>
                <div className="flex flex-wrap gap-2">
                  <Link
                    href="/standings"
                    className={clsx(
                      'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                      !leagueId
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
                          leagueId === l.id
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
                </div>
              </div>
            )}

            {endedSeasons.length > 0 && !leagueId && (
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
            {leagueId && selectedLeague && selectedLeague.seasons.length > 1 && (
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
        {(leagueId || seasonId) && selectedLeagueDivisions.length > 0 && (
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
        {!leagueId && !seasonId && activeSeasons.length === 0 && allLeagues.length > 0 && (
          <div className="bg-bb-dark border border-bb-border rounded-sm p-8 text-center mb-8">
            <p className="text-bb-muted text-sm">No active seasons right now.</p>
            <p className="text-bb-muted/50 text-xs mt-1">Select a past season above to view its standings.</p>
          </div>
        )}

        {/* ── Standings blocks ───────────────────────────────────────── */}
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

        {/* ── Past seasons cards (default view only) ────────────────── */}
        {!leagueId && !seasonId && endedSeasons.length > 0 && (
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
