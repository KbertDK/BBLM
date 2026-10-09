'use client'

import { useState, useEffect, useCallback } from 'react'
import clsx from 'clsx'

interface TeamMatch {
  id: string
  round: number
  homeScore: number | null
  awayScore: number | null
  homeTeam: { id: string; name: string }
  awayTeam: { id: string; name: string }
}

interface MatchStat {
  id: string
  touchdowns: number
  completePasses: number
  interceptions: number
  casualties: number
  mvp: number
  ssp: number
  match: {
    id: string
    round: number
    homeScore: number | null
    awayScore: number | null
    homeTeam: { id: string; name: string }
    awayTeam: { id: string; name: string }
  }
}

interface Props {
  playerName: string
  playerNumber: number
  playerPosition: string
  teamId: string
  teamMatches: TeamMatch[]
  matchStats: MatchStat[]
}

function StatCell({ value, highlight }: { value: number; highlight?: boolean }) {
  if (value === 0) return <td className="px-3 py-2.5 text-center text-bb-muted/30 tabular-nums text-sm">—</td>
  return (
    <td className={clsx(
      'px-3 py-2.5 text-center font-bold tabular-nums text-sm',
      highlight ? 'text-bb-gold' : 'text-white/80',
    )}>
      {value}
    </td>
  )
}

export default function PlayerHistoryModal({
  playerName, playerNumber, playerPosition, teamId, teamMatches, matchStats,
}: Props) {
  const [open, setOpen] = useState(false)

  const close = useCallback(() => setOpen(false), [])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close])

  // Build a stat lookup keyed by match id
  const statByMatch = new Map(matchStats.map((s) => [s.match.id, s]))

  // Merged rows: one per completed team match, stats filled in (or zero if no record)
  const rows = teamMatches.map((m) => {
    const s = statByMatch.get(m.id)
    return {
      matchId:        m.id,
      round:          m.round,
      homeScore:      m.homeScore,
      awayScore:      m.awayScore,
      homeTeam:       m.homeTeam,
      awayTeam:       m.awayTeam,
      touchdowns:     s?.touchdowns     ?? 0,
      completePasses: s?.completePasses ?? 0,
      interceptions:  s?.interceptions  ?? 0,
      casualties:     s?.casualties     ?? 0,
      mvp:            s?.mvp            ?? 0,
      ssp:            s?.ssp            ?? 0,
      hasRecord:      s != null,
    }
  })

  const totals = rows.reduce(
    (acc, r) => ({
      td:  acc.td  + r.touchdowns,
      cp:  acc.cp  + r.completePasses,
      int: acc.int + r.interceptions,
      cas: acc.cas + r.casualties,
      mvp: acc.mvp + r.mvp,
      ssp: acc.ssp + r.ssp,
    }),
    { td: 0, cp: 0, int: 0, cas: 0, mvp: 0, ssp: 0 }
  )

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title={`Match history — ${teamMatches.length} ${teamMatches.length === 1 ? 'game' : 'games'}`}
        className="inline-flex flex-col items-center gap-0.5 text-bb-muted/60 hover:text-bb-gold transition-colors cursor-pointer group"
      >
        <svg className="w-4 h-4 group-hover:text-bb-gold transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <span className="text-[10px] font-heading tabular-nums leading-none">{teamMatches.length}</span>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          aria-modal="true"
          role="dialog"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-sm"
            onClick={close}
          />

          {/* Panel */}
          <div className="relative z-10 w-full max-w-2xl max-h-[85vh] flex flex-col bg-bb-dark border border-bb-gold/30 rounded-sm shadow-2xl shadow-black/60">

            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-bb-border bg-bb-darker rounded-t-sm">
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/60">
                    #{playerNumber}
                  </span>
                  <h2 className="font-heading text-lg font-bold text-white tracking-wide">
                    {playerName}
                  </h2>
                </div>
                <p className="text-xs text-bb-muted/70">
                  {playerPosition} · {teamMatches.length} {teamMatches.length === 1 ? 'match' : 'matches'}
                </p>
              </div>
              <button
                onClick={close}
                className="text-bb-muted/50 hover:text-white transition-colors text-xl leading-none mt-0.5 ml-4"
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {/* Table */}
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-bb-darker border-b border-bb-border">
                    <th className="px-4 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-left">Rnd</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-left">Match</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-center">Score</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-gold/60 text-center">TD</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-center">CP</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-center">Int</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-center">Cas</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-center">MVP</th>
                    <th className="px-3 py-2.5 text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 text-center">SSP</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isHome = r.homeTeam.id === teamId
                    const ourScore  = isHome ? r.homeScore : r.awayScore
                    const oppScore  = isHome ? r.awayScore : r.homeScore
                    const opponent  = isHome ? r.awayTeam.name : r.homeTeam.name
                    const hasScore  = ourScore != null && oppScore != null
                    const won  = hasScore && ourScore! > oppScore!
                    const drew = hasScore && ourScore! === oppScore!

                    return (
                      <tr
                        key={r.matchId}
                        className={clsx(
                          'border-b border-bb-border/50 last:border-0 transition-colors',
                          r.hasRecord ? 'hover:bg-bb-gold/5' : 'opacity-50 hover:opacity-70',
                        )}
                      >
                        <td className="px-4 py-2.5 text-xs text-bb-muted/60 font-heading tabular-nums">
                          R{r.round}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-white/80 max-w-[160px]">
                          <span className="text-[10px] text-bb-muted/40 mr-1">vs</span>
                          <span className="truncate">{opponent}</span>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {hasScore ? (
                            <span className={clsx(
                              'font-heading font-bold text-xs tabular-nums',
                              won  ? 'text-green-400' :
                              drew ? 'text-bb-muted'  :
                                     'text-bb-crimson-bright',
                            )}>
                              {ourScore}–{oppScore}
                            </span>
                          ) : (
                            <span className="text-bb-muted/30 text-xs">—</span>
                          )}
                        </td>
                        <StatCell value={r.touchdowns}    highlight />
                        <StatCell value={r.completePasses} />
                        <StatCell value={r.interceptions}  />
                        <StatCell value={r.casualties}     />
                        <StatCell value={r.mvp}            />
                        <StatCell value={r.ssp}            />
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Career totals footer */}
            <div className="border-t border-bb-gold/20 bg-bb-darker px-4 py-3 rounded-b-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 mr-1">Career</span>
                {([
                  { label: 'TD',  value: totals.td,  gold: true  },
                  { label: 'CP',  value: totals.cp,  gold: false },
                  { label: 'Int', value: totals.int, gold: false },
                  { label: 'Cas', value: totals.cas, gold: false },
                  { label: 'MVP', value: totals.mvp, gold: false },
                  { label: 'SSP', value: totals.ssp, gold: false },
                ] as const).map(({ label, value, gold }) => (
                  <span key={label} className="flex items-center gap-1 text-xs">
                    <span className="text-bb-muted/50 font-heading text-[10px] uppercase tracking-wider">{label}</span>
                    <span className={clsx('font-heading font-bold', gold ? 'text-bb-gold' : 'text-white/80')}>
                      {value}
                    </span>
                    <span className="text-bb-muted/20 last:hidden">·</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
