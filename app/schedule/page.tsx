import Link from 'next/link'
import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { format } from 'date-fns'
import clsx from 'clsx'

export const revalidate = 60

type Props = { searchParams: Promise<{ leagueId?: string; divisionId?: string }> }

const STATUS_CLS: Record<string, string> = {
  SCHEDULED: 'text-bb-muted/70 border-bb-muted/30 bg-bb-darker',
  LIVE:      'text-bb-crimson-bright border-bb-crimson-bright/50 bg-bb-crimson/10',
  COMPLETED: 'text-bb-gold/70 border-bb-gold/20 bg-bb-darker',
}
const STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Sched.',
  LIVE:      'LIVE',
  COMPLETED: 'Final',
}

export default async function SchedulePage({ searchParams }: Props) {
  const { leagueId, divisionId } = await searchParams

  // Default to the user's primary league when no league is selected
  if (!leagueId) {
    const session = await getSession()
    if (session?.coachId) {
      const coach = await prisma.coach.findUnique({
        where:  { id: session.coachId },
        select: { primaryLeagueId: true },
      })
      if (coach?.primaryLeagueId) redirect(`/schedule?leagueId=${coach.primaryLeagueId}`)
    }
  }

  const leagues = await prisma.league.findMany({
    where: { isHidden: false, status: { in: ['READY', 'ACTIVE'] } },
    orderBy: [{ status: 'asc' }, { name: 'asc' }],
    select: { id: true, name: true, season: true, status: true },
  })

  const divisions = leagueId
    ? await prisma.division.findMany({
        where: { leagueId, isHidden: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      })
    : []

  const selectedLeague   = leagueId   ? (leagues.find((l) => l.id === leagueId)     ?? null) : null
  const selectedDivision = divisionId ? (divisions.find((d) => d.id === divisionId) ?? null) : null

  const matches = await prisma.match.findMany({
    where: leagueId
      ? {
          leagueId,
          ...(divisionId
            ? { OR: [{ homeTeam: { divisionId } }, { awayTeam: { divisionId } }] }
            : {}),
        }
      : {
          status: { in: ['SCHEDULED', 'LIVE'] },
          league: { isHidden: false, status: { in: ['READY', 'ACTIVE'] } },
        },
    include: {
      tournament: { select: { id: true, name: true } },
      league:     { select: { id: true, name: true, season: true } },
      homeTeam:   { select: { id: true, name: true, division: { select: { id: true, name: true } } } },
      awayTeam:   { select: { id: true, name: true, division: { select: { id: true, name: true } } } },
    },
    orderBy: leagueId
      ? [{ round: 'asc' }, { scheduledAt: { sort: 'asc', nulls: 'last' } }]
      : [{ scheduledAt: { sort: 'asc', nulls: 'last' } }],
  })

  type MatchRow = typeof matches[number]
  type RoundEntry = { round: number; matches: MatchRow[]; sortDate: Date | null }
  type TournamentGroup = { id: string | null; name: string; rounds: RoundEntry[] }

  // All-leagues view: LIVE first, then rest
  const sortedMatches = leagueId
    ? matches
    : [
        ...matches.filter((m) => m.status === 'LIVE'),
        ...matches.filter((m) => m.status !== 'LIVE'),
      ]

  // League view: group by tournament → round, sorted by earliest match date per round
  const tournamentGroups: TournamentGroup[] = []
  if (leagueId) {
    const byTournament = new Map<string | null, typeof matches>()
    for (const m of matches) {
      const key = m.tournament?.id ?? null
      if (!byTournament.has(key)) byTournament.set(key, [])
      byTournament.get(key)!.push(m)
    }

    // Named tournaments first, ungrouped (null) last
    const orderedKeys: (string | null)[] = [
      ...[...byTournament.keys()].filter((k) => k !== null),
      ...(byTournament.has(null) ? [null] : []),
    ]

    for (const tId of orderedKeys) {
      const tMatches = byTournament.get(tId)!
      const name = tMatches[0]?.tournament?.name ?? 'Other Matches'

      const byRound = new Map<number, typeof matches>()
      for (const m of tMatches) {
        if (!byRound.has(m.round)) byRound.set(m.round, [])
        byRound.get(m.round)!.push(m)
      }

      const rounds: RoundEntry[] = Array.from(byRound.entries())
        .map(([round, rMatches]) => {
          const dates = rMatches
            .filter((m) => m.scheduledAt)
            .map((m) => m.scheduledAt!)
            .sort((a, b) => a.getTime() - b.getTime())
          return { round, matches: rMatches, sortDate: dates[0] ?? null }
        })
        .sort((a, b) => {
          if (!a.sortDate && !b.sortDate) return a.round - b.round
          if (!a.sortDate) return 1
          if (!b.sortDate) return -1
          return a.sortDate.getTime() - b.sortDate.getTime()
        })

      tournamentGroups.push({ id: tId, name, rounds })
    }
  }

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        {/* Page heading */}
        <div className="text-center mb-10">
          <div className="flex items-center gap-4 justify-center mb-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-bb-gold/60 max-w-32" />
            <h1 className="font-heading text-3xl font-bold text-bb-gold tracking-widest uppercase">
              Schedule
            </h1>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-bb-gold/60 max-w-32" />
          </div>
          <p className="text-bb-muted text-sm tracking-wide mt-1 italic">
            Who will be blessed by Nuffle?
          </p>
        </div>

        {/* League filter pills */}
        <div className="mb-2">
          <p className="text-xs font-heading tracking-widest uppercase text-bb-muted/50 mb-2">League</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/schedule"
              className={clsx(
                'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                !leagueId
                  ? 'bg-bb-gold text-bb-navy border-bb-gold font-bold'
                  : 'border-bb-border text-bb-muted hover:border-bb-gold/40 hover:text-bb-gold',
              )}
            >
              All Leagues
            </Link>
            {leagues.map((l) => (
              <Link
                key={l.id}
                href={`/schedule?leagueId=${l.id}`}
                className={clsx(
                  'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                  leagueId === l.id
                    ? 'bg-bb-gold text-bb-navy border-bb-gold font-bold'
                    : 'border-bb-border text-bb-muted hover:border-bb-gold/40 hover:text-bb-gold',
                )}
              >
                {l.name}
                {l.status === 'ACTIVE' && (
                  <span className="ml-1.5 text-bb-crimson-bright text-[10px] normal-case font-bold">●</span>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Division filter pills — matches standings style, shown when league has any divisions */}
        {leagueId && divisions.length > 0 && (
          <div className="mb-8 mt-3">
            <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Division</p>
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/schedule?leagueId=${leagueId}`}
                className={clsx(
                  'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                  !divisionId
                    ? 'bg-bb-gold/20 text-bb-gold border-bb-gold/50 font-bold'
                    : 'border-bb-border/50 text-bb-muted hover:border-bb-gold/30 hover:text-bb-gold/70',
                )}
              >
                All Divisions
              </Link>
              {divisions.map((d) => (
                <Link
                  key={d.id}
                  href={`/schedule?leagueId=${leagueId}&divisionId=${d.id}`}
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

        {/* Spacer when no division filter shown */}
        {!(leagueId && divisions.length > 0) && <div className="mb-8" />}

        {/* ── League view: grouped by tournament → round ──────────────── */}
        {leagueId && (
          <>
            {matches.length === 0 ? (
              <div className="bg-bb-dark border border-bb-border rounded-sm p-8 text-center">
                <p className="text-bb-muted text-sm italic">No matches found for this selection.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {tournamentGroups.map((tg) => (
                  <div key={tg.id ?? '_ungrouped'}>
                    {/* Tournament section header — only when multiple groups exist */}
                    {tournamentGroups.length > 1 && (
                      <div className="flex items-center gap-3 mb-3">
                        <span className="text-xs font-heading tracking-widest uppercase text-bb-gold/60">
                          {tg.name}
                        </span>
                        <div className="flex-1 h-px bg-bb-border/60" />
                      </div>
                    )}

                    <div className="flex flex-col gap-4">
                      {tg.rounds.map(({ round, matches: roundMatches, sortDate }) => {
                        const dates = roundMatches
                          .filter((m) => m.scheduledAt)
                          .map((m) => m.scheduledAt!)
                          .sort((a, b) => a.getTime() - b.getTime())
                        const dateRange =
                          dates.length === 0
                            ? 'Dates TBD'
                            : dates.length === 1
                            ? format(dates[0], 'EEE d MMM')
                            : `${format(dates[0], 'd MMM')} – ${format(dates[dates.length - 1], 'd MMM')}`

                        return (
                          <div
                            key={round}
                            className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-lg shadow-black/40"
                          >
                            {/* Round header */}
                            <div className="flex items-center justify-between px-5 py-3 bg-bb-darker border-b border-bb-border">
                              <span className="font-heading text-sm font-bold tracking-widest uppercase text-bb-gold">
                                Round {round}
                              </span>
                              <span className="text-xs text-bb-muted">{dateRange}</span>
                            </div>

                            {/* Matches */}
                            <div className="divide-y divide-bb-border/60">
                              {roundMatches.map((m) => {
                                const divName =
                                  m.homeTeam.division?.name ?? m.awayTeam.division?.name ?? null
                                const isCompleted = m.status === 'COMPLETED'
                                const homeWon =
                                  isCompleted && (m.homeScore ?? 0) > (m.awayScore ?? 0)
                                const awayWon =
                                  isCompleted && (m.awayScore ?? 0) > (m.homeScore ?? 0)

                                return (
                                  <div
                                    key={m.id}
                                    className="grid grid-cols-[1fr_auto_1fr] items-center gap-4 px-5 py-4"
                                  >
                                    {/* Home team */}
                                    <div className="flex items-center gap-2 justify-end text-right">
                                      <span
                                        className={clsx(
                                          'font-heading font-bold text-sm truncate',
                                          homeWon ? 'text-bb-gold' : 'text-white/90',
                                        )}
                                      >
                                        {m.homeTeam.name}
                                      </span>
                                    </div>

                                    {/* Centre: score / vs + meta */}
                                    <div className="flex flex-col items-center gap-1 min-w-[120px]">
                                      {isCompleted ? (
                                        <span className="font-heading text-xl font-black text-bb-gold tracking-wider">
                                          {m.homeScore} – {m.awayScore}
                                        </span>
                                      ) : m.status === 'LIVE' ? (
                                        <span className="font-heading text-lg font-black text-bb-crimson-bright animate-pulse">
                                          LIVE
                                        </span>
                                      ) : (
                                        <span className="text-bb-muted/50 text-xs font-heading tracking-widest uppercase">vs</span>
                                      )}

                                      <div className="flex flex-wrap items-center justify-center gap-1.5">
                                        <span
                                          className={clsx(
                                            'text-[10px] font-heading tracking-wider uppercase px-1.5 py-0.5 rounded-sm border',
                                            STATUS_CLS[m.status],
                                          )}
                                        >
                                          {STATUS_LABEL[m.status]}
                                        </span>
                                        {divName && divisions.length > 1 && (
                                          <span className="text-[10px] text-bb-muted/60 border border-bb-muted/20 px-1.5 py-0.5 rounded-sm font-heading tracking-wide uppercase truncate max-w-[100px]">
                                            {divName}
                                          </span>
                                        )}
                                      </div>

                                      <span className="text-[11px] text-bb-muted/60">
                                        {m.scheduledAt
                                          ? format(m.scheduledAt, 'EEE d MMM · HH:mm')
                                          : 'TBD'}
                                      </span>
                                    </div>

                                    {/* Away team */}
                                    <div className="flex items-center gap-2">
                                      <span
                                        className={clsx(
                                          'font-heading font-bold text-sm truncate',
                                          awayWon ? 'text-bb-gold' : 'text-white/90',
                                        )}
                                      >
                                        {m.awayTeam.name}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── All-leagues view: flat list with league+division context ── */}
        {!leagueId && (
          <>
            {sortedMatches.length === 0 ? (
              <div className="bg-bb-dark border border-bb-border rounded-sm p-8 text-center">
                <p className="text-bb-muted text-sm italic">No upcoming fixtures at this time.</p>
              </div>
            ) : (
              <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-lg shadow-black/40">
                <div className="grid grid-cols-[140px_1fr_auto_1fr_110px] text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-5 py-3 gap-3">
                  <span>League · Division</span>
                  <span className="text-right">Home</span>
                  <span className="text-center">Rnd</span>
                  <span>Away</span>
                  <span className="text-right">Date</span>
                </div>

                <div className="divide-y divide-bb-border/60">
                  {sortedMatches.map((m) => {
                    const divName = m.homeTeam.division?.name ?? m.awayTeam.division?.name ?? null
                    const isLive = m.status === 'LIVE'

                    return (
                      <div
                        key={m.id}
                        className={clsx(
                          'grid grid-cols-[140px_1fr_auto_1fr_110px] items-center px-5 py-3.5 gap-3',
                          isLive && 'bg-bb-crimson/5',
                        )}
                      >
                        <div className="flex flex-col gap-0.5">
                          <Link
                            href={`/schedule?leagueId=${m.league.id}`}
                            className="text-[10px] text-bb-gold/70 hover:text-bb-gold font-heading tracking-wide uppercase leading-tight truncate transition-colors"
                          >
                            {m.league.name}
                          </Link>
                          {divName && (
                            <span className="text-[10px] text-bb-muted/50 leading-tight truncate">
                              {divName}
                            </span>
                          )}
                        </div>

                        <div className="text-right">
                          <span className="font-heading font-bold text-sm text-white/90 truncate block">
                            {m.homeTeam.name}
                          </span>
                        </div>

                        <div className="flex flex-col items-center min-w-[48px]">
                          {isLive ? (
                            <span className="text-xs font-heading font-black text-bb-crimson-bright animate-pulse">
                              LIVE
                            </span>
                          ) : (
                            <span className="text-[10px] text-bb-muted/50 font-heading tracking-wider uppercase">
                              R{m.round}
                            </span>
                          )}
                        </div>

                        <div>
                          <span className="font-heading font-bold text-sm text-white/90 truncate block">
                            {m.awayTeam.name}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[11px] text-bb-muted/70">
                            {m.scheduledAt ? format(m.scheduledAt, 'EEE d MMM') : 'TBD'}
                          </span>
                          {m.scheduledAt && (
                            <span className="block text-[11px] text-bb-muted/50">
                              {format(m.scheduledAt, 'HH:mm')}
                            </span>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </>
        )}

        {/* League quick-pick when no league selected */}
        {!leagueId && leagues.length > 0 && (
          <div className="mt-10">
            <h2 className="font-heading text-xs tracking-widest uppercase text-bb-muted/50 mb-4 border-b border-bb-border pb-2">
              Jump to league schedule
            </h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {leagues.map((l) => (
                <Link
                  key={l.id}
                  href={`/schedule?leagueId=${l.id}`}
                  className="flex items-center justify-between px-5 py-4 bg-bb-dark border border-bb-gold/20 rounded-sm hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors group"
                >
                  <div>
                    <p className="font-heading font-bold text-white group-hover:text-bb-gold transition-colors text-sm leading-tight">
                      {l.name}
                    </p>
                    <p className="text-xs text-bb-muted mt-0.5">Season {l.season}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {l.status === 'ACTIVE' && (
                      <span className="text-[10px] font-heading tracking-wider uppercase px-2 py-0.5 rounded-sm border text-bb-crimson-bright border-bb-crimson-bright/40 bg-bb-crimson/10">
                        Active
                      </span>
                    )}
                    {l.status === 'READY' && (
                      <span className="text-[10px] font-heading tracking-wider uppercase px-2 py-0.5 rounded-sm border text-bb-muted border-bb-muted/30">
                        Ready
                      </span>
                    )}
                    <span className="text-bb-gold/40 group-hover:text-bb-gold transition-colors">→</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
