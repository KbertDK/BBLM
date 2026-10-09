import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getMatchReport } from '@/lib/queries/matches'

interface PageProps {
  params: Promise<{ id: string }>
}

const EVENT_ICON: Record<string, string> = {
  TD:           '🏈',
  CASUALTY:     '💀',
  INTERCEPTION: '🖐',
  HALFTIME:     '⛔',
  WEATHER:      '🌦️',
  SPECIAL_CARD: '🃏',
  KICKOFF:      '🏈',
}

const EVENT_COLOR: Record<string, string> = {
  TD:           'border-bb-gold/40 bg-bb-gold/5 text-white',
  CASUALTY:     'border-bb-crimson/40 bg-bb-crimson/5 text-white',
  INTERCEPTION: 'border-bb-border/50 text-bb-muted',
  HALFTIME:     'border-transparent text-bb-muted/50 italic text-center text-xs',
  WEATHER:      'border-sky-700/40 bg-sky-900/10 text-sky-200',
  SPECIAL_CARD: 'border-purple-700/40 bg-purple-900/10 text-purple-200',
  KICKOFF:      'border-sky-700/40 bg-sky-900/10 text-sky-200',
}

export default async function MatchReportPage({ params }: PageProps) {
  const { id } = await params
  const match = await getMatchReport(id)

  if (!match) notFound()
  const report = match   // re-narrowed binding: TS doesn't carry `match`'s narrowing into nested function closures below

  const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0)
  const awayWon = (match.awayScore ?? 0) > (match.homeScore ?? 0)
  const isDraw  = !homeWon && !awayWon

  // Split events at half-time
  const halftimeIdx = match.events.findIndex((e) => e.type === 'HALFTIME')

  function sideStats(side: 'home' | 'away') {
    const teamId = side === 'home' ? report.homeTeam.id : report.awayTeam.id
    const roster = report.matchPlayerStats
      .filter((s) => s.teamPlayer.teamId === teamId)
      .map((s) => ({
        key: s.id,
        name: `#${s.teamPlayer.number} ${s.teamPlayer.name ?? s.teamPlayer.playerType.name}`,
        badge: null as string | null,
        touchdowns: s.touchdowns, completePasses: s.completePasses, interceptions: s.interceptions,
        casualties: s.casualties, mvp: s.mvp, ssp: s.ssp,
      }))
    const mercs = report.mercs
      .filter((m) => m.side === side)
      .map((m) => ({
        key: m.id, name: m.playerType.name, badge: 'MERC',
        touchdowns: 0, completePasses: 0, interceptions: 0, casualties: 0, mvp: m.mvp, ssp: m.mvp * 5,
      }))
    const stars = report.starPlayers
      .filter((m) => m.side === side)
      .map((m) => ({
        key: m.id, name: m.starPlayer.name, badge: 'STAR',
        touchdowns: 0, completePasses: 0, interceptions: 0, casualties: 0, mvp: m.mvp, ssp: m.mvp * 5,
      }))
    const journeymen = report.journeymen
      .filter((m) => m.side === side)
      .map((m) => ({
        key: m.id, name: m.playerType.name, badge: 'JM',
        touchdowns: m.touchdowns, completePasses: m.completePasses, interceptions: m.interceptions,
        casualties: m.casualties, mvp: m.mvp, ssp: m.ssp,
      }))
    return [...roster, ...journeymen, ...mercs, ...stars]
  }

  const homeStats = sideStats('home')
  const awayStats = sideStats('away')

  return (
    <div className="min-h-screen bg-grimdark-gradient">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-12">

        {/* Breadcrumb */}
        <div className="mb-8">
          <Link href="/" className="text-bb-muted text-xs font-heading uppercase tracking-widest hover:text-bb-gold transition-colors">
            ← Back to League
          </Link>
        </div>

        {/* Match header */}
        <div className="bg-bb-dark border border-bb-border rounded-sm p-6 sm:p-8 mb-8">
          {/* League / Round / Date */}
          <div className="text-center mb-6">
            <span className="text-xs text-bb-gold/60 font-heading uppercase tracking-widest">
              {match.league.name}{match.season ? ` · ${match.season.name}` : ''} · Round {match.round}
              {match.scheduledAt && ` · ${format(new Date(match.scheduledAt), 'd MMMM yyyy')}`}
            </span>
          </div>

          {/* Score */}
          <div className="flex items-center justify-center gap-6 sm:gap-10">
            <div className="flex-1 text-right">
              <Link href={`/teams/${match.homeTeam.id}`}
                className={`block font-heading text-xl sm:text-2xl font-bold hover:text-bb-gold transition-colors ${homeWon ? 'text-bb-gold' : 'text-white'}`}>
                {match.homeTeam.name}
              </Link>
              <p className="text-xs text-bb-muted mt-1">{match.homeTeam.race.name}</p>
            </div>

            <div className="shrink-0 text-center">
              <div className="font-heading text-5xl sm:text-6xl font-black tracking-tight">
                <span className={homeWon ? 'text-bb-gold' : 'text-bb-muted'}>{match.homeScore ?? 0}</span>
                <span className="text-bb-border mx-2">–</span>
                <span className={awayWon ? 'text-bb-gold' : 'text-bb-muted'}>{match.awayScore ?? 0}</span>
              </div>
              <div className="mt-2 text-xs font-heading uppercase tracking-widest">
                {isDraw
                  ? <span className="text-bb-muted">Draw</span>
                  : <span className="text-bb-gold">
                      {homeWon ? match.homeTeam.name : match.awayTeam.name} wins
                    </span>}
              </div>
            </div>

            <div className="flex-1 text-left">
              <Link href={`/teams/${match.awayTeam.id}`}
                className={`block font-heading text-xl sm:text-2xl font-bold hover:text-bb-gold transition-colors ${awayWon ? 'text-bb-gold' : 'text-white'}`}>
                {match.awayTeam.name}
              </Link>
              <p className="text-xs text-bb-muted mt-1">{match.awayTeam.race.name}</p>
            </div>
          </div>
        </div>

        {/* Event log */}
        <div className="bg-bb-dark border border-bb-border rounded-sm p-6">
          <h2 className="font-heading text-sm font-bold text-bb-gold uppercase tracking-widest mb-5">
            Match Report
          </h2>

          {match.events.length === 0 ? (
            <p className="text-bb-muted text-sm italic text-center py-6">
              No play-by-play recorded for this match.
            </p>
          ) : (
            <div className="space-y-2">
              {/* 1st half label (only if there's a halftime event) */}
              {halftimeIdx !== -1 && (
                <p className="text-[10px] text-bb-muted/50 font-heading uppercase tracking-widest mb-1">
                  1st Half
                </p>
              )}

              {match.events.map((event, i) => {
                const colorCls = EVENT_COLOR[event.type] ?? 'border-bb-border/50 text-bb-muted'
                const isHalf   = event.type === 'HALFTIME'
                const showSecondHalfLabel = halftimeIdx !== -1 && i === halftimeIdx

                return (
                  <div key={event.id}>
                    {isHalf ? (
                      <div className="flex items-center gap-3 py-2">
                        <div className="flex-1 h-px bg-bb-border/30" />
                        <span className="text-[10px] text-bb-muted/50 font-heading uppercase tracking-widest shrink-0">
                          Half Time
                        </span>
                        <div className="flex-1 h-px bg-bb-border/30" />
                      </div>
                    ) : (
                      <div className={`flex items-start gap-3 px-3 py-2.5 rounded-sm border text-sm ${colorCls}`}>
                        <span className="shrink-0 mt-0.5">{EVENT_ICON[event.type] ?? '•'}</span>
                        <span className="leading-snug">{event.label}</span>
                      </div>
                    )}

                    {/* "2nd Half" label immediately after the halftime divider */}
                    {showSecondHalfLabel && i < match.events.length - 1 && (
                      <p className="text-[10px] text-bb-muted/50 font-heading uppercase tracking-widest mt-3 mb-1">
                        2nd Half
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Player stats */}
        {(homeStats.length > 0 || awayStats.length > 0) && (
          <div className="mt-6 grid sm:grid-cols-2 gap-4">
            {[{ label: match.homeTeam.name, rows: homeStats }, { label: match.awayTeam.name, rows: awayStats }].map(({ label, rows }) => (
              <div key={label} className="bg-bb-dark border border-bb-border rounded-sm p-4">
                <h3 className="font-heading text-xs font-bold text-bb-gold uppercase tracking-widest mb-3">{label}</h3>
                {rows.length === 0 ? (
                  <p className="text-bb-muted text-xs italic">No individual stats recorded.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-bb-muted/60 font-heading uppercase tracking-wider">
                          <th className="text-left py-1 pr-2">Player</th>
                          <th className="text-center py-1 px-1" title="Touchdowns">TD</th>
                          <th className="text-center py-1 px-1" title="Complete Passes">CP</th>
                          <th className="text-center py-1 px-1" title="Interceptions">Int</th>
                          <th className="text-center py-1 px-1" title="Casualties">Cas</th>
                          <th className="text-center py-1 px-1" title="MVP">MVP</th>
                          <th className="text-center py-1 pl-1" title="SPP earned this match">SSP</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-bb-border/30">
                        {rows.map((r) => (
                          <tr key={r.key}>
                            <td className="py-1.5 pr-2 text-white">
                              {r.name}
                              {r.badge && <span className="ml-1.5 text-[9px] text-bb-muted border border-bb-border/60 px-1 py-0.5 rounded-sm">{r.badge}</span>}
                            </td>
                            <td className="text-center py-1.5 px-1 text-bb-gold font-bold tabular-nums">{r.touchdowns}</td>
                            <td className="text-center py-1.5 px-1 text-bb-muted tabular-nums">{r.completePasses}</td>
                            <td className="text-center py-1.5 px-1 text-bb-muted tabular-nums">{r.interceptions}</td>
                            <td className="text-center py-1.5 px-1 text-bb-muted tabular-nums">{r.casualties}</td>
                            <td className="text-center py-1.5 px-1 text-bb-muted tabular-nums">{r.mvp}</td>
                            <td className="text-center py-1.5 pl-1 text-bb-muted tabular-nums">{r.ssp}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Team links */}
        <div className="mt-6 flex gap-3 justify-center text-xs font-heading uppercase tracking-widest">
          <Link href={`/teams/${match.homeTeam.id}`}
            className="px-4 py-2 border border-bb-border text-bb-muted hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors">
            {match.homeTeam.name} →
          </Link>
          <Link href={`/teams/${match.awayTeam.id}`}
            className="px-4 py-2 border border-bb-border text-bb-muted hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors">
            {match.awayTeam.name} →
          </Link>
        </div>

      </div>
    </div>
  )
}
