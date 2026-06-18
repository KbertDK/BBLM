import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import clsx from 'clsx'

export const revalidate = 60

type Props = { searchParams: Promise<{ leagueId?: string; divisionId?: string }> }

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'text-bb-gold border-bb-gold/40 bg-bb-gold/5',
  READY:  'text-green-400 border-green-700/50 bg-green-900/10',
  ENDED:  'text-bb-muted border-bb-muted/30 bg-bb-muted/5',
}
const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  READY:  'Ready',
  ENDED:  'Ended',
}

// Tiebreak: pts → wins → draws → fewest losses
function sortTeams<T extends { wins: number; draws: number; losses: number }>(
  teams: T[],
  pw: number, pd: number, pl: number,
): T[] {
  return [...teams].sort((a, b) => {
    const ptsA = a.wins * pw + a.draws * pd + a.losses * pl
    const ptsB = b.wins * pw + b.draws * pd + b.losses * pl
    if (ptsB !== ptsA) return ptsB - ptsA
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.draws !== a.draws) return b.draws - a.draws
    return a.losses - b.losses
  })
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="font-heading font-black text-bb-gold text-base">1</span>
  if (rank === 2) return <span className="font-heading font-bold text-slate-300 text-sm">2</span>
  if (rank === 3) return <span className="font-heading font-bold text-amber-700 text-sm">3</span>
  return <span className="font-heading text-sm text-bb-muted/40">{rank}</span>
}

interface TeamRow {
  id: string
  name: string
  race: string
  coachName: string
  wins: number
  draws: number
  losses: number
  teamValue: number
  divisionId: string | null
}

interface TournamentGroup {
  id: string
  name: string
  teams: TeamRow[]
}

interface LeagueBlock {
  id: string
  name: string
  season: number
  status: string
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  tournamentGroups: TournamentGroup[]
  ungroupedTeams: TeamRow[]
}

function TeamTable({ teams, pointsWin, pointsDraw, pointsLoss }: {
  teams: TeamRow[]
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
}) {
  return (
    <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden">
      <div className="grid grid-cols-[32px_1fr_140px_72px_64px_32px_32px_32px_48px] text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-4 py-2.5 gap-2">
        <span className="text-center">#</span>
        <span>Team</span>
        <span>Coach</span>
        <span>Race</span>
        <span className="text-right" title="Team Value in thousands">TV</span>
        <span className="text-center">W</span>
        <span className="text-center">D</span>
        <span className="text-center">L</span>
        <span className="text-center">Pts</span>
      </div>

      {teams.length === 0 && (
        <p className="text-bb-muted/50 text-sm italic px-4 py-4">No teams.</p>
      )}

      {teams.map((team, i) => {
        const pts = team.wins * pointsWin + team.draws * pointsDraw + team.losses * pointsLoss
        const isFirst = i === 0
        return (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className={clsx(
              'grid grid-cols-[32px_1fr_140px_72px_64px_32px_32px_32px_48px] items-center px-4 py-3 gap-2 border-b border-bb-border/60 last:border-0 transition-colors group',
              isFirst ? 'hover:bg-bb-gold/8' : 'hover:bg-bb-gold/5',
            )}
          >
            <div className="text-center"><RankMedal rank={i + 1} /></div>
            <div className="min-w-0">
              <span className={clsx(
                'font-heading font-bold text-sm leading-tight block truncate transition-colors group-hover:text-bb-gold',
                isFirst ? 'text-white' : 'text-white/85',
              )}>
                {team.name}
              </span>
            </div>
            <span className="text-xs text-bb-muted truncate">{team.coachName}</span>
            <span className="text-xs text-bb-muted/60 truncate">{team.race}</span>
            <span className="text-right font-heading font-bold text-sm text-bb-gold/80 tabular-nums" title="Team Value">
              {team.teamValue.toLocaleString()}
              <span className="text-bb-muted/50 font-normal text-xs ml-0.5">k</span>
            </span>
            <span className="text-center text-sm font-semibold text-green-400">{team.wins}</span>
            <span className="text-center text-sm text-bb-muted">{team.draws}</span>
            <span className="text-center text-sm text-bb-crimson-bright">{team.losses}</span>
            <span className={clsx(
              'text-center font-heading font-black text-base',
              isFirst ? 'text-bb-gold' : 'text-bb-gold/70',
            )}>
              {pts}
            </span>
          </Link>
        )
      })}
    </div>
  )
}

function StandingsTable({ league }: { league: LeagueBlock }) {
  const { pointsWin, pointsDraw, pointsLoss, tournamentGroups, ungroupedTeams } = league
  const hasGroups = tournamentGroups.length > 0

  return (
    <div className="flex flex-col gap-4">
      {tournamentGroups.map((group) => {
        const sorted = sortTeams(group.teams, pointsWin, pointsDraw, pointsLoss)
        return (
          <div key={group.id}>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-heading tracking-widest uppercase text-bb-gold/70">{group.name}</span>
              <div className="flex-1 h-px bg-bb-border/60" />
            </div>
            <TeamTable teams={sorted} pointsWin={pointsWin} pointsDraw={pointsDraw} pointsLoss={pointsLoss} />
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
          <TeamTable
            teams={sortTeams(ungroupedTeams, pointsWin, pointsDraw, pointsLoss)}
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
  const { leagueId, divisionId } = await searchParams

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

  const allLeagues = await prisma.league.findMany({
    where:   { isHidden: false },
    orderBy: [{ status: 'asc' }, { season: 'desc' }, { name: 'asc' }],
    select:  {
      id: true, name: true, season: true, status: true,
      ruleSet: { select: { pointsWin: true, pointsDraw: true, pointsLoss: true } },
    },
  })

  const activeLeagues = allLeagues.filter((l) => l.status === 'ACTIVE' || l.status === 'READY')
  const endedLeagues  = allLeagues.filter((l) => l.status === 'ENDED')

  const targetLeagues = leagueId
    ? allLeagues.filter((l) => l.id === leagueId)
    : activeLeagues

  // Divisions for the selected league — used for the division filter UI
  const selectedLeagueDivisions = leagueId
    ? await prisma.division.findMany({
        where:   { leagueId, isHidden: false },
        orderBy: { name: 'asc' },
        select:  { id: true, name: true },
      })
    : []

  const leagueIds = targetLeagues.map((l) => l.id)

  // Prisma returns [] automatically when `in: []`, so no need to guard
  const [teams, tournaments] = await Promise.all([
    prisma.team.findMany({
      where:   {
        leagueId:            { in: leagueIds },
        ...(divisionId ? { divisionId } : {}),
      },
      include: {
        race:    { select: { name: true, rerollPrice: true } },
        coach:   { select: { name: true, alias: true } },
        players: {
          where:  { status: { in: ['ACTIVE', 'MNG'] } },
          select: { value: true, playerType: { select: { cost: true } } },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.tournament.findMany({
      where:   { divisions: { some: { leagueId: { in: leagueIds } } } },
      include: { divisions: { select: { id: true, leagueId: true } } },
      orderBy: { name: 'asc' },
    }),
  ])

  const leagueBlocks: LeagueBlock[] = targetLeagues.map((league) => {
    const leagueTeams: TeamRow[] = teams
      .filter((t) => t.leagueId === league.id)
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
        return {
          id:         t.id,
          name:       t.name,
          race:       t.race.name,
          coachName:  t.coach.alias ?? t.coach.name,
          wins:       t.wins,
          draws:      t.draws,
          losses:     t.losses,
          teamValue,
          divisionId: t.divisionId,
        }
      })

    const leagueTournaments = tournaments.filter(
      (t) => t.divisions.some((d) => d.leagueId === league.id)
    )

    const tournamentGroups: TournamentGroup[] = leagueTournaments.map((tournament) => {
      const divisionIds = new Set(
        tournament.divisions
          .filter((d) => d.leagueId === league.id)
          .map((d) => d.id)
      )
      return {
        id:    tournament.id,
        name:  tournament.name,
        teams: leagueTeams.filter((t) => t.divisionId != null && divisionIds.has(t.divisionId)),
      }
    })

    const assignedIds   = new Set(tournamentGroups.flatMap((g) => g.teams.map((t) => t.id)))
    const ungroupedTeams = leagueTeams.filter((t) => !assignedIds.has(t.id))

    return {
      id:               league.id,
      name:             league.name,
      season:           league.season,
      status:           league.status,
      pointsWin:        league.ruleSet?.pointsWin  ?? 3,
      pointsDraw:       league.ruleSet?.pointsDraw ?? 1,
      pointsLoss:       league.ruleSet?.pointsLoss ?? 0,
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
            {activeLeagues.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Selected League</p>
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
                  {activeLeagues.map((l) => (
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
                      {l.status === 'ACTIVE' && (
                        <span className="ml-1.5 text-[10px] text-bb-crimson-bright">●</span>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {endedLeagues.length > 0 && (
              <div>
                <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Past Seasons</p>
                <div className="flex flex-wrap gap-2">
                  {endedLeagues.map((l) => (
                    <Link
                      key={l.id}
                      href={`/standings?leagueId=${l.id}`}
                      className={clsx(
                        'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                        leagueId === l.id
                          ? 'bg-bb-muted/20 text-white border-bb-muted/60 font-bold'
                          : 'border-bb-border/50 text-bb-muted/60 hover:border-bb-muted/50 hover:text-bb-muted',
                      )}
                    >
                      {l.name} <span className="opacity-50">S{l.season}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Division filter — shown when a league is selected ─────── */}
        {leagueId && selectedLeagueDivisions.length > 0 && (
          <div className="mb-8">
            <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Division</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/standings?leagueId=${leagueId}`}
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
                  href={`/standings?leagueId=${leagueId}&divisionId=${d.id}`}
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

        {/* ── No active leagues, nothing selected ───────────────────── */}
        {!leagueId && activeLeagues.length === 0 && allLeagues.length > 0 && (
          <div className="bg-bb-dark border border-bb-border rounded-sm p-8 text-center mb-8">
            <p className="text-bb-muted text-sm">No active leagues right now.</p>
            <p className="text-bb-muted/50 text-xs mt-1">Select a past season above to view its standings.</p>
          </div>
        )}

        {/* ── Standings blocks ───────────────────────────────────────── */}
        <div className="flex flex-col gap-10">
          {leagueBlocks.map((league) => (
            <section key={league.id}>
              {(leagueBlocks.length > 1 || leagueId) && (
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <h2 className="font-heading text-xl font-bold text-white tracking-wide">{league.name}</h2>
                    <span className={clsx(
                      'text-[10px] font-heading tracking-wider uppercase px-1.5 py-0.5 rounded-sm border',
                      STATUS_CLS[league.status],
                    )}>
                      {STATUS_LABEL[league.status]}
                    </span>
                  </div>
                  <div className="flex-1 h-px bg-bb-border ml-2" />
                  <Link
                    href={`/standings?leagueId=${league.id}`}
                    className="text-xs text-bb-muted hover:text-bb-gold transition-colors font-heading tracking-wide uppercase shrink-0"
                  >
                    Full view →
                  </Link>
                </div>
              )}

              {league.tournamentGroups.length === 0 && league.ungroupedTeams.length === 0 ? (
                <div className="bg-bb-dark border border-bb-border rounded-sm p-6 text-center">
                  <p className="text-bb-muted/50 text-sm italic">No teams assigned to this league yet.</p>
                </div>
              ) : (
                <StandingsTable league={league} />
              )}
            </section>
          ))}
        </div>

        {/* ── Past seasons cards (default view only) ────────────────── */}
        {!leagueId && endedLeagues.length > 0 && (
          <div className="mt-14">
            <div className="flex items-center gap-4 mb-5">
              <h2 className="font-heading text-sm font-bold text-bb-muted/60 tracking-widest uppercase whitespace-nowrap">
                Past Seasons
              </h2>
              <div className="flex-1 h-px bg-bb-border/50" />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {endedLeagues.map((l) => (
                <Link
                  key={l.id}
                  href={`/standings?leagueId=${l.id}`}
                  className="flex items-center justify-between px-4 py-3 bg-bb-dark border border-bb-border/50 rounded-sm hover:border-bb-muted/40 hover:bg-bb-darker/60 transition-colors group"
                >
                  <p className="font-heading font-bold text-bb-muted/80 group-hover:text-white text-sm transition-colors leading-tight">
                    {l.name}
                  </p>
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
