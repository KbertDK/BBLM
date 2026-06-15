import Link from 'next/link'
import prisma from '@/lib/prisma'
import clsx from 'clsx'

export const revalidate = 60

type Props = { searchParams: Promise<{ leagueId?: string }> }

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
  divisionName: string | null
}

interface LeagueBlock {
  id: string
  name: string
  season: number
  status: string
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
  teams: TeamRow[]
}

function StandingsTable({ league }: { league: LeagueBlock }) {
  const { pointsWin, pointsDraw, pointsLoss } = league

  // Group teams by division
  const divMap = new Map<string | null, { id: string | null; name: string | null; teams: TeamRow[] }>()

  for (const t of league.teams) {
    const key = t.divisionId
    if (!divMap.has(key)) divMap.set(key, { id: t.divisionId, name: t.divisionName, teams: [] })
    divMap.get(key)!.teams.push(t)
  }

  // Sort: named divisions first (alphabetically), undivided last
  const groups = Array.from(divMap.values()).sort((a, b) => {
    if (a.id === null) return 1
    if (b.id === null) return -1
    return (a.name ?? '').localeCompare(b.name ?? '')
  })

  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => {
        const sorted = sortTeams(group.teams, pointsWin, pointsDraw, pointsLoss)
        return (
          <div key={group.id ?? '__none__'}>
            {groups.length > 1 && (
              <div className="flex items-center gap-3 mb-2">
                <span className="text-xs font-heading tracking-widest uppercase text-bb-gold/70">
                  {group.name ?? 'No Division'}
                </span>
                <div className="flex-1 h-px bg-bb-border/60" />
              </div>
            )}

            <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden">
              {/* Header */}
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

              {sorted.length === 0 && (
                <p className="text-bb-muted/50 text-sm italic px-4 py-4">No teams in this division yet.</p>
              )}

              {sorted.map((team, i) => {
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
                    <div className="text-center">
                      <RankMedal rank={i + 1} />
                    </div>

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

            {/* Points key */}
            <p className="text-[10px] text-bb-muted/40 mt-1.5 text-right font-heading tracking-wide">
              W={pointsWin} · D={pointsDraw} · L={pointsLoss} pts
            </p>
          </div>
        )
      })}
    </div>
  )
}

export default async function StandingsPage({ searchParams }: Props) {
  const { leagueId } = await searchParams

  // All non-hidden leagues for the filter UI
  const allLeagues = await prisma.league.findMany({
    where: { isHidden: false },
    orderBy: [{ status: 'asc' }, { season: 'desc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      season: true,
      status: true,
      ruleSet: { select: { pointsWin: true, pointsDraw: true, pointsLoss: true } },
    },
  })

  const activeLeagues = allLeagues.filter((l) => l.status === 'ACTIVE' || l.status === 'READY')
  const endedLeagues  = allLeagues.filter((l) => l.status === 'ENDED')

  // Which leagues to show standings for
  const targetLeagues = leagueId
    ? allLeagues.filter((l) => l.id === leagueId)
    : activeLeagues

  // Fetch teams for target leagues
  const teams = targetLeagues.length > 0
    ? await prisma.team.findMany({
        where:   { leagueId: { in: targetLeagues.map((l) => l.id) } },
        include: {
          race:     { select: { name: true, rerollPrice: true } },
          coach:    { select: { name: true, alias: true } },
          division: { select: { id: true, name: true } },
          players:  {
            where:  { status: { in: ['ACTIVE', 'MNG'] } },
            select: { value: true, playerType: { select: { cost: true } } },
          },
        },
        orderBy: { name: 'asc' },
      })
    : []

  // Build league blocks
  const leagueBlocks: LeagueBlock[] = targetLeagues.map((league) => ({
    id:          league.id,
    name:        league.name,
    season:      league.season,
    status:      league.status,
    pointsWin:   league.ruleSet?.pointsWin  ?? 3,
    pointsDraw:  league.ruleSet?.pointsDraw ?? 1,
    pointsLoss:  league.ruleSet?.pointsLoss ?? 0,
    teams: teams
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
          id:           t.id,
          name:         t.name,
          race:         t.race.name,
          coachName:    t.coach.alias ?? t.coach.name,
          wins:         t.wins,
          draws:        t.draws,
          losses:       t.losses,
          teamValue,
          divisionId:   t.divisionId,
          divisionName: t.division?.name ?? null,
        }
      }),
  }))

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
            {selectedLeague
              ? `${selectedLeague.name} — Season ${selectedLeague.season}`
              : 'All ongoing leagues'}
          </p>
        </div>

        {/* ── League filter pills ────────────────────────────────────── */}
        {allLeagues.length > 0 && (
          <div className="mb-8">
            {/* Active / Ready */}
            {activeLeagues.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Current Seasons</p>
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

            {/* Ended */}
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
              {/* League header — only shown when multiple leagues are visible */}
              {(leagueBlocks.length > 1 || leagueId) && (
                <div className="flex items-center gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-heading text-xl font-bold text-white tracking-wide">{league.name}</h2>
                      <span className={clsx(
                        'text-[10px] font-heading tracking-wider uppercase px-1.5 py-0.5 rounded-sm border',
                        STATUS_CLS[league.status],
                      )}>
                        {STATUS_LABEL[league.status]}
                      </span>
                    </div>
                    <p className="text-xs text-bb-muted mt-0.5">Season {league.season}</p>
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

              {league.teams.length === 0 ? (
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
                  <div>
                    <p className="font-heading font-bold text-bb-muted/80 group-hover:text-white text-sm transition-colors leading-tight">
                      {l.name}
                    </p>
                    <p className="text-xs text-bb-muted/40 mt-0.5">Season {l.season}</p>
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
