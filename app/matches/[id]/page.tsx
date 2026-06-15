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
}

const EVENT_COLOR: Record<string, string> = {
  TD:           'border-bb-gold/40 bg-bb-gold/5 text-white',
  CASUALTY:     'border-bb-crimson/40 bg-bb-crimson/5 text-white',
  INTERCEPTION: 'border-bb-border/50 text-bb-muted',
  HALFTIME:     'border-transparent text-bb-muted/50 italic text-center text-xs',
}

export default async function MatchReportPage({ params }: PageProps) {
  const { id } = await params
  const match = await getMatchReport(id)

  if (!match) notFound()

  const homeWon = (match.homeScore ?? 0) > (match.awayScore ?? 0)
  const awayWon = (match.awayScore ?? 0) > (match.homeScore ?? 0)
  const isDraw  = !homeWon && !awayWon

  // Split events at half-time
  const halftimeIdx = match.events.findIndex((e) => e.type === 'HALFTIME')

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
              {match.league.name} · Season {match.league.season} · Round {match.round}
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
