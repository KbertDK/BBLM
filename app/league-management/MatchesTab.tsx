'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  addMonths, subMonths, getDay, isSameDay,
} from 'date-fns'
import {
  createMatch, deleteMatch, setMatchLive, completeMatch,
  generateRoundRobin, bulkSetMatchDates,
} from './match-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface League    { id: string; name: string; season: number }
export interface Division  { id: string; name: string }
export interface TournamentOption { id: string; name: string; divisionIds: string[] }
export interface TeamOption { id: string; name: string; divisionId: string | null }
export interface MatchRow {
  id: string
  round: number
  homeTeamId: string
  homeTeamName: string
  homeTeamDivisionId: string | null
  awayTeamId: string
  awayTeamName: string
  awayTeamDivisionId: string | null
  scheduledAt: string | null   // ISO string or null
  status: 'SCHEDULED' | 'LIVE' | 'COMPLETED'
  homeScore: number | null
  awayScore: number | null
}

interface Props {
  matchLeagues:      League[]
  selectedLeagueId?: string
  leagueDivisions:   Division[]
  leagueTeams:       TeamOption[]
  matches:           MatchRow[]
  tournaments:       TournamentOption[]
}

// ── Constants ─────────────────────────────────────────────────────────────────

const MATCH_STATUS_CLS: Record<string, string> = {
  SCHEDULED: 'border-bb-muted/30  text-bb-muted   bg-bb-muted/5',
  LIVE:      'border-green-700/50 text-green-400   bg-green-900/10',
  COMPLETED: 'border-bb-border    text-bb-muted/50 bg-bb-darker',
}
const MATCH_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  LIVE:      'Live',
  COMPLETED: 'Completed',
}

// ── Shared style helpers ──────────────────────────────────────────────────────

function inputCls(extra = '') {
  return `bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40 ${extra}`
}

function btnCls(variant: 'primary' | 'ghost' | 'danger' | 'muted' = 'ghost', extra = '') {
  const base = 'text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const v = {
    primary: 'bg-bb-crimson hover:bg-bb-crimson-bright text-white',
    ghost:   'border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted',
    danger:  'border border-bb-crimson/40 text-bb-crimson-bright hover:bg-bb-crimson/20',
    muted:   'text-bb-muted/50 border border-bb-border/50',
  }
  return `${base} ${v[variant]} ${extra}`
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-xs px-1.5 py-0.5 rounded-sm border ${cls}`}>{label}</span>
}

function Chevron({ cls = '' }: { cls?: string }) {
  return (
    <svg className={`w-3 h-3 shrink-0 transition-transform group-open:rotate-90 ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── DatePickerInput ───────────────────────────────────────────────────────────

const CAL_H = 292  // approximate calendar height in px
const CAL_W = 224  // w-56

function DatePickerInput({ name, defaultValue }: { name: string; defaultValue?: string }) {
  const [open, setOpen]               = useState(false)
  const [calStyle, setCalStyle]       = useState<React.CSSProperties>({})
  const [viewMonth, setViewMonth]     = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    defaultValue ? new Date(defaultValue) : null
  )
  const [time, setTime] = useState('14:00')
  const wrapperRef = useRef<HTMLDivElement>(null)
  const btnRef     = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    function onOut(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onScroll() { setOpen(false) }
    document.addEventListener('mousedown', onOut)
    window.addEventListener('scroll', onScroll, true)
    return () => {
      document.removeEventListener('mousedown', onOut)
      window.removeEventListener('scroll', onScroll, true)
    }
  }, [open])

  function toggleCalendar() {
    if (open) { setOpen(false); return }
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const top = window.innerHeight - r.bottom >= CAL_H
        ? r.bottom + 4
        : r.top - CAL_H - 4
      const left = Math.min(r.left, window.innerWidth - CAL_W - 8)
      setCalStyle({ top, left })
    }
    setOpen(true)
  }

  const hiddenValue = selectedDate ? `${format(selectedDate, 'yyyy-MM-dd')}T${time}` : ''

  const monthStart  = startOfMonth(viewMonth)
  const days        = eachDayOfInterval({ start: monthStart, end: endOfMonth(viewMonth) })
  const leadingPads = (getDay(monthStart) + 6) % 7

  return (
    <div ref={wrapperRef} className="relative">
      <input type="hidden" name={name} value={hiddenValue} />
      <div className="flex gap-1.5 items-center">
        <button
          ref={btnRef}
          type="button"
          onClick={toggleCalendar}
          className="flex items-center gap-2 bg-bb-darker border border-bb-border hover:border-bb-gold/60 text-sm px-3 py-2 rounded-sm transition-colors min-w-[148px]"
        >
          <span className="text-bb-muted text-xs">📅</span>
          <span className={selectedDate ? 'text-white' : 'text-bb-muted/50'}>
            {selectedDate ? format(selectedDate, 'd MMM yyyy') : 'Pick date…'}
          </span>
        </button>
        <input
          type="time"
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className={inputCls('w-24')}
        />
      </div>

      {open && (
        <div
          style={{ position: 'fixed', zIndex: 9999, ...calStyle }}
          className="bg-bb-dark border border-bb-border rounded-sm shadow-2xl p-3 w-56"
        >
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={() => setViewMonth((m) => subMonths(m, 1))}
              className="text-bb-muted hover:text-white w-7 h-7 flex items-center justify-center rounded-sm hover:bg-bb-border/30"
            >◀</button>
            <span className="text-sm font-heading text-bb-gold tracking-wide">
              {format(viewMonth, 'MMM yyyy')}
            </span>
            <button
              type="button"
              onClick={() => setViewMonth((m) => addMonths(m, 1))}
              className="text-bb-muted hover:text-white w-7 h-7 flex items-center justify-center rounded-sm hover:bg-bb-border/30"
            >▶</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-0.5">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => (
              <div key={d} className="text-center text-[10px] text-bb-muted/40 py-0.5">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: leadingPads }).map((_, i) => <div key={`p${i}`} />)}
            {days.map((day) => {
              const sel = selectedDate ? isSameDay(day, selectedDate) : false
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => { setSelectedDate(day); setOpen(false) }}
                  className={`text-xs py-1 rounded-sm transition-colors text-center leading-none ${
                    sel
                      ? 'bg-bb-gold/20 text-bb-gold font-bold'
                      : 'text-white hover:bg-bb-gold/10 hover:text-bb-gold'
                  }`}
                >
                  {format(day, 'd')}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatchesTab({
  matchLeagues,
  selectedLeagueId,
  leagueDivisions,
  leagueTeams,
  matches,
  tournaments,
}: Props) {
  const router = useRouter()
  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set())
  const [selectedTournamentId, setSelectedTournamentId] = useState<string>('')

  // Auto-select the single division when there's only one
  const effectiveDivisionId = leagueDivisions.length === 1
    ? leagueDivisions[0].id
    : undefined

  useEffect(() => {
    if (selectedLeagueId && leagueDivisions.length === 1) {
      router.replace(
        `/league-management?tab=matches&leagueId=${selectedLeagueId}&divisionId=${leagueDivisions[0].id}`
      )
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLeagueId, leagueDivisions.length])

  // Derive current state from URL (props) or auto-select
  const divisionId = effectiveDivisionId

  const divisionTeams = divisionId
    ? leagueTeams.filter((t) => t.divisionId === divisionId)
    : leagueTeams

  const divisionMatches = divisionId
    ? matches.filter(
        (m) => m.homeTeamDivisionId === divisionId || m.awayTeamDivisionId === divisionId
      )
    : matches

  const nextRound = divisionMatches.length > 0
    ? Math.max(...divisionMatches.map((m) => m.round)) + 1
    : 1

  // Group matches by round for display
  const rounds = divisionMatches.reduce<Map<number, MatchRow[]>>((acc, m) => {
    if (!acc.has(m.round)) acc.set(m.round, [])
    acc.get(m.round)!.push(m)
    return acc
  }, new Map())
  const sortedRounds = Array.from(rounds.entries()).sort(([a], [b]) => a - b)

  // Checkbox helpers
  function toggleMatch(id: string) {
    setSelectedMatchIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleRound(ids: string[]) {
    const allSelected = ids.every((id) => selectedMatchIds.has(id))
    setSelectedMatchIds((prev) => {
      const next = new Set(prev)
      ids.forEach((id) => allSelected ? next.delete(id) : next.add(id))
      return next
    })
  }

  const hasDivision    = !!divisionId
  const hasTournament  = !!selectedTournamentId
  const canSchedule    = hasDivision && hasTournament && divisionTeams.length >= 2

  return (
    <div className="space-y-6">

      {/* League picker */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-2 flex-1 min-w-0">
          <select
            defaultValue={selectedLeagueId ?? ''}
            onChange={(e) => {
              const id = e.target.value
              setSelectedTournamentId('')
              if (id) router.push(`/league-management?tab=matches&leagueId=${id}`)
              else router.push('/league-management?tab=matches')
            }}
            className={inputCls('flex-1 min-w-0')}
          >
            <option value="">— Select a league —</option>
            {matchLeagues.map((l) => (
              <option key={l.id} value={l.id}>{l.name} · S{l.season}</option>
            ))}
          </select>
        </div>

        {/* Division picker — only when league has multiple divisions */}
        {selectedLeagueId && leagueDivisions.length > 1 && (
          <select
            defaultValue={effectiveDivisionId ?? ''}
            onChange={(e) => {
              const d = e.target.value
              const base = `/league-management?tab=matches&leagueId=${selectedLeagueId}`
              router.push(d ? `${base}&divisionId=${d}` : base)
            }}
            className={inputCls('min-w-[160px]')}
          >
            <option value="">— Select a division —</option>
            {leagueDivisions.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tournament picker — required before creating matches */}
      {selectedLeagueId && (
        <select
          value={selectedTournamentId}
          onChange={(e) => setSelectedTournamentId(e.target.value)}
          className={inputCls('w-full')}
        >
          <option value="">— Select a tournament —</option>
          {tournaments.map((t) => (
            <option key={t.id} value={t.id}>{t.name}</option>
          ))}
        </select>
      )}

      {!selectedLeagueId ? (
        <div className="bg-bb-dark border border-bb-border rounded-sm px-6 py-10 text-center">
          <p className="text-bb-muted/50 text-sm italic">Select a league above to manage matches.</p>
        </div>
      ) : !hasTournament ? (
        <div className="bg-bb-dark border border-bb-border rounded-sm px-6 py-10 text-center">
          <p className="text-bb-muted/50 text-sm italic">Select a tournament above to manage matches.</p>
        </div>
      ) : !hasDivision ? (
        <div className="bg-bb-dark border border-bb-border rounded-sm px-6 py-10 text-center">
          <p className="text-bb-muted/50 text-sm italic">Select a division above to manage matches.</p>
        </div>
      ) : (
        <>
          {/* Round Robin generator */}
          <details className="group bg-bb-dark border border-bb-border rounded-sm">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
              <Chevron cls="text-bb-muted" />
              <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Generate Round Robin</span>
            </summary>
            <form action={generateRoundRobin} className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3">
              <input type="hidden" name="leagueId"      value={selectedLeagueId} />
              <input type="hidden" name="divisionId"    value={divisionId} />
              <input type="hidden" name="tournamentId"  value={selectedTournamentId} />
              {divisionTeams.length < 2 ? (
                <p className="text-bb-crimson-bright text-xs">At least 2 teams must be in the division to generate a round robin.</p>
              ) : (
                <>
                  <p className="text-bb-muted text-xs">
                    Generates {divisionTeams.length % 2 === 0
                      ? divisionTeams.length - 1
                      : divisionTeams.length} rounds ·{' '}
                    {Math.floor(divisionTeams.length / 2)} match{Math.floor(divisionTeams.length / 2) !== 1 ? 'es' : ''} per round.
                    Already-scheduled pairings are skipped.
                  </p>
                  <div className="flex items-end gap-3">
                    <div>
                      <label className="text-xs text-bb-muted mb-1 block uppercase tracking-widest">Starting round</label>
                      <input
                        name="startRound"
                        type="number"
                        min={1}
                        defaultValue={nextRound}
                        className={inputCls('w-24')}
                      />
                    </div>
                    <button type="submit" className={btnCls('primary')}>Generate matches</button>
                  </div>
                </>
              )}
            </form>
          </details>

          {/* Manual schedule a match */}
          <details className="group bg-bb-dark border border-bb-border rounded-sm">
            <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
              <Chevron cls="text-bb-muted" />
              <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Schedule a match</span>
            </summary>
            {!canSchedule ? (
              <p className="px-4 pb-4 pt-3 border-t border-bb-border/40 text-bb-muted/50 text-xs italic">
                At least 2 teams must be in the selected division.
              </p>
            ) : (
              <form action={createMatch} className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3">
                <input type="hidden" name="leagueId"     value={selectedLeagueId} />
                <input type="hidden" name="divisionId"   value={divisionId} />
                <input type="hidden" name="tournamentId" value={selectedTournamentId} />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select name="homeTeamId" required className={inputCls()}>
                    <option value="">— Home team —</option>
                    {divisionTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  <select name="awayTeamId" required className={inputCls()}>
                    <option value="">— Away team —</option>
                    {divisionTeams.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-end">
                  <div>
                    <label className="text-xs text-bb-muted mb-1 block uppercase tracking-widest">Round</label>
                    <input
                      name="round"
                      type="number"
                      required
                      min={1}
                      defaultValue={nextRound}
                      className={inputCls('w-full')}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-bb-muted mb-1 block uppercase tracking-widest">Date &amp; Time</label>
                    <DatePickerInput name="scheduledAt" />
                  </div>
                </div>

                <button type="submit" className={btnCls('primary', 'w-full sm:w-auto')}>Schedule Match</button>
              </form>
            )}
          </details>

          {/* Match list */}
          <div className="border border-bb-border rounded-sm overflow-hidden">
            {divisionMatches.length === 0 ? (
              <p className="text-bb-muted/50 text-sm italic px-4 py-6 text-center">
                No matches yet. Generate a round robin or schedule individual matches above.
              </p>
            ) : (
              sortedRounds.map(([round, roundMatches]) => {
                const scheduledInRound = roundMatches.filter((m) => m.status === 'SCHEDULED').map((m) => m.id)
                const allRoundSelected = scheduledInRound.length > 0 && scheduledInRound.every((id) => selectedMatchIds.has(id))
                const someRoundSelected = scheduledInRound.some((id) => selectedMatchIds.has(id))

                const selectedInRound = scheduledInRound.filter((id) => selectedMatchIds.has(id))

                return (
                  <div key={round}>
                    {/* Round header */}
                    <div className="flex items-center gap-3 px-4 py-1.5 bg-bb-darker border-b border-bb-border/40">
                      {scheduledInRound.length > 0 && (
                        <input
                          type="checkbox"
                          checked={allRoundSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someRoundSelected && !allRoundSelected
                          }}
                          onChange={() => toggleRound(scheduledInRound)}
                          className="accent-bb-gold w-3.5 h-3.5 cursor-pointer"
                          title={allRoundSelected ? 'Deselect round' : 'Select all in round'}
                        />
                      )}
                      <span className="text-xs font-heading text-bb-muted/60 uppercase tracking-widest">
                        Round {round}
                      </span>
                    </div>

                    {/* Inline date picker — visible when this round has selected matches */}
                    {selectedInRound.length > 0 && (
                      <form
                        action={bulkSetMatchDates}
                        onSubmit={() =>
                          setSelectedMatchIds((prev) => {
                            const next = new Set(prev)
                            selectedInRound.forEach((id) => next.delete(id))
                            return next
                          })
                        }
                        className="flex flex-wrap items-center gap-3 px-4 py-2.5 bg-bb-gold/5 border-b border-bb-border/40"
                      >
                        {selectedInRound.map((id) => (
                          <input key={id} type="hidden" name="matchId" value={id} />
                        ))}
                        <span className="text-xs text-bb-muted shrink-0">
                          <span className="text-bb-gold font-medium">{selectedInRound.length}</span>{' '}
                          match{selectedInRound.length !== 1 ? 'es' : ''} selected
                        </span>
                        <DatePickerInput name="scheduledAt" />
                        <button type="submit" className={btnCls('primary')}>Apply date</button>
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedMatchIds((prev) => {
                              const next = new Set(prev)
                              selectedInRound.forEach((id) => next.delete(id))
                              return next
                            })
                          }
                          className={btnCls('ghost')}
                        >
                          Clear
                        </button>
                      </form>
                    )}

                    {/* Match rows */}
                    {roundMatches.map((match) => {
                      const isScheduled = match.status === 'SCHEDULED'
                      const isSelected  = selectedMatchIds.has(match.id)

                      return (
                        <div
                          key={match.id}
                          className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5 border-b border-bb-border/30 last:border-0 transition-colors ${
                            isSelected ? 'bg-bb-gold/5' : 'bg-bb-dark'
                          }`}
                        >
                          {/* Checkbox */}
                          <div className="w-4 shrink-0">
                            {isScheduled && (
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleMatch(match.id)}
                                className="accent-bb-gold w-3.5 h-3.5 cursor-pointer"
                              />
                            )}
                          </div>

                          <span className="font-medium text-sm text-white min-w-[7rem] flex-1 truncate">
                            {match.homeTeamName}
                          </span>
                          <span className="text-bb-muted text-xs shrink-0">vs</span>
                          <span className="font-medium text-sm text-white min-w-[7rem] flex-1 truncate">
                            {match.awayTeamName}
                          </span>

                          <span className="text-bb-muted text-xs w-24 text-right shrink-0">
                            {match.scheduledAt
                              ? new Date(match.scheduledAt).toLocaleDateString('en', {
                                  day: 'numeric', month: 'short', year: '2-digit',
                                })
                              : <span className="text-bb-muted/40 italic">TBD</span>
                            }
                          </span>

                          <Badge label={MATCH_STATUS_LABEL[match.status]} cls={MATCH_STATUS_CLS[match.status]} />

                          {/* Actions */}
                          {isScheduled && (
                            <div className="flex gap-1 shrink-0 ml-auto">
                              <form action={setMatchLive}>
                                <input type="hidden" name="matchId" value={match.id} />
                                <button type="submit" className={btnCls('ghost')}>▶ Live</button>
                              </form>
                              <form action={deleteMatch}>
                                <input type="hidden" name="matchId" value={match.id} />
                                <button type="submit" className={btnCls('danger')}>✕</button>
                              </form>
                            </div>
                          )}

                          {match.status === 'LIVE' && (
                            <form action={completeMatch} className="flex items-center gap-1.5 shrink-0 ml-auto">
                              <input type="hidden" name="matchId" value={match.id} />
                              <input
                                name="homeScore"
                                type="number"
                                min={0}
                                defaultValue={0}
                                className="w-12 bg-bb-darker border border-bb-border text-white text-center text-sm px-1 py-1 rounded-sm focus:outline-none focus:border-bb-gold/60"
                              />
                              <span className="text-bb-muted text-xs">–</span>
                              <input
                                name="awayScore"
                                type="number"
                                min={0}
                                defaultValue={0}
                                className="w-12 bg-bb-darker border border-bb-border text-white text-center text-sm px-1 py-1 rounded-sm focus:outline-none focus:border-bb-gold/60"
                              />
                              <button type="submit" className={btnCls('ghost')}>✓ Done</button>
                            </form>
                          )}

                          {match.status === 'COMPLETED' && (
                            <div className="flex items-center gap-3 ml-auto shrink-0">
                              <span className="text-bb-gold font-mono text-sm font-bold">
                                {match.homeScore} – {match.awayScore}
                              </span>
                              <Link
                                href={`/matches/${match.id}`}
                                className="text-[10px] font-heading uppercase tracking-widest text-bb-muted hover:text-bb-gold transition-colors"
                              >
                                Report →
                              </Link>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

    </div>
  )
}
