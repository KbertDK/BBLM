'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { startMatch, completeMatchFull, pushMatchEvent, deleteLastMatchEvent } from './actions'
import { getRaceLogo } from '@/lib/race-logo'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase          = 'prematch' | 'live' | 'postmatch'
type CasualtyResult = 'KO' | 'BH' | 'MNG' | 'DEAD'

export interface MatchSkill {
  name: string
  rule: string
}

export interface MatchPlayer {
  id:             string
  number:         number
  name:           string | null
  status:         'ACTIVE' | 'MNG'
  playerTypeName: string
  ma:             number
  st:             number
  ag:             number
  av:             number
  ssp:            number
  skills:         MatchSkill[]
}

export interface MatchTeamData {
  id:       string
  name:     string
  coachId:  string
  raceName: string
  players:  MatchPlayer[]
}

export interface MatchData {
  id:       string
  status:   'SCHEDULED' | 'LIVE'
  round:    number
  homeTeam: MatchTeamData
  awayTeam: MatchTeamData
}

interface MatchEvent {
  id:             string
  type:           'TD' | 'CASUALTY' | 'INTERCEPTION' | 'HALFTIME'
  turn?:          number        // which turn (1–16) the event occurred on
  // TD
  scoringTeam?:   'home' | 'away'
  scorerId?:      string
  passerId?:      string        // set = completion off a pass
  // CASUALTY
  attackerId?:    string
  victimId?:      string
  casualtyResult?: CasualtyResult
  // INTERCEPTION
  interceptorId?: string
  label:          string
}

interface GameState {
  phase:            Phase
  turn:             number      // 1–16; 1–8 = 1st half, 9–16 = 2nd half
  lineup:           { home: string[]; away: string[] }
  events:           MatchEvent[]
  mvp:              { home: string | null; away: string | null }
  winnings:         { home: number; away: number }
  injuryOverrides:  Record<string, 'BH' | 'MNG' | 'DEAD'>   // keyed by playerId
}

type ModalState =
  | { type: 'td';          step: 1 | 2 | 3; team: 'home' | 'away' | null; scorerId: string | null; hasPass: boolean; passerId: string | null }
  | { type: 'casualty';    step: 1 | 2 | 3 | 4; attackTeam: 'home' | 'away' | null; attackerId: string | null; victimId: string | null; result: CasualtyResult | null }
  | { type: 'interception'; step: 1 | 2; team: 'home' | 'away' | null; playerId: string | null }
  | null

interface PlayerUpdate {
  playerId:           string
  deltaTouchdowns:    number
  deltaCompletePasses: number
  deltaInterceptions: number
  deltaCasualties:    number
  deltaSSP:           number
  deltaMVP:           number
  newStatus:          'ACTIVE' | 'MNG' | 'DEAD' | null
  isDeathPost:        boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function playerLabel(p: MatchPlayer) {
  const name = p.name?.trim() || p.playerTypeName
  return `#${p.number} ${name}`
}

function playerLabelFull(p: MatchPlayer) {
  const name = p.name?.trim() || p.playerTypeName
  return `#${p.number} ${name} (${p.playerTypeName})`
}

function computeScore(events: MatchEvent[]) {
  return {
    home: events.filter((e) => e.type === 'TD' && e.scoringTeam === 'home').length,
    away: events.filter((e) => e.type === 'TD' && e.scoringTeam === 'away').length,
  }
}

const CAS_SEVERITY: Record<CasualtyResult, number> = { KO: 0, BH: 1, MNG: 2, DEAD: 3 }

function computePlayerUpdates(
  state: GameState,
  allPlayers: MatchPlayer[],
): PlayerUpdate[] {
  const { events, lineup, mvp, injuryOverrides } = state
  const lineupSet = new Set([...lineup.home, ...lineup.away])
  const mvpSet    = new Set([mvp.home, mvp.away].filter(Boolean) as string[])

  // Worst casualty result per victim
  const worstCas = new Map<string, CasualtyResult>()
  for (const e of events) {
    if (e.type === 'CASUALTY' && e.victimId && e.casualtyResult) {
      const existing = worstCas.get(e.victimId)
      if (!existing || CAS_SEVERITY[e.casualtyResult] > CAS_SEVERITY[existing]) {
        worstCas.set(e.victimId, e.casualtyResult)
      }
    }
  }

  const updates: PlayerUpdate[] = []

  for (const p of allPlayers) {
    if (!lineupSet.has(p.id)) continue

    const deltaTouchdowns    = events.filter((e) => e.type === 'TD' && e.scorerId === p.id).length
    const deltaCompletePasses = events.filter((e) => e.type === 'TD' && e.passerId === p.id).length
    const deltaInterceptions = events.filter((e) => e.type === 'INTERCEPTION' && e.interceptorId === p.id).length
    const deltaCasualties    = events.filter(
      (e) => e.type === 'CASUALTY' && e.attackerId === p.id && e.casualtyResult !== 'KO',
    ).length
    const deltaMVP = mvpSet.has(p.id) ? 1 : 0

    const deltaSSP =
      deltaTouchdowns     * 3 +
      deltaCompletePasses * 1 +
      deltaInterceptions  * 2 +
      deltaCasualties     * 2 +
      deltaMVP            * 5

    // Effective injury status (override wins over computed)
    const override    = injuryOverrides[p.id]
    const computed    = worstCas.get(p.id)
    const effectiveCas = override ? override : computed

    const newStatus: 'MNG' | 'DEAD' | null =
      effectiveCas === 'DEAD' ? 'DEAD' :
      effectiveCas === 'MNG'  ? 'MNG'  :
      null

    const isDeathPost = newStatus === 'DEAD'

    if (deltaTouchdowns || deltaCompletePasses || deltaInterceptions || deltaCasualties || deltaMVP || newStatus) {
      updates.push({
        playerId: p.id,
        deltaTouchdowns,
        deltaCompletePasses,
        deltaInterceptions,
        deltaCasualties,
        deltaSSP,
        deltaMVP,
        newStatus,
        isDeathPost,
      })
    }
  }

  return updates
}

// ─── SSP helpers ──────────────────────────────────────────────────────────────

function getSspInfo(ssp: number): { levelName: string; toNext: number | null; nearPromotion: boolean } {
  let levelName = 'Legend'
  let nextThreshold: number | null = null
  if      (ssp < 6)   { levelName = 'Rookie';        nextThreshold = 6   }
  else if (ssp < 16)  { levelName = 'Experienced';   nextThreshold = 16  }
  else if (ssp < 31)  { levelName = 'Veteran';        nextThreshold = 31  }
  else if (ssp < 51)  { levelName = 'Emerging Star';  nextThreshold = 51  }
  else if (ssp < 76)  { levelName = 'Star';           nextThreshold = 76  }
  else if (ssp < 176) { levelName = 'Super Star';     nextThreshold = 176 }
  const toNext = nextThreshold !== null ? nextThreshold - ssp : null
  return { levelName, toNext, nearPromotion: toNext !== null && toNext <= 3 }
}

// ─── Roster Modal ─────────────────────────────────────────────────────────────

function RosterModal({
  team, players, logo, matchSspMap, onClose,
}: {
  team:        MatchTeamData
  players:     MatchPlayer[]
  logo:        string | null
  matchSspMap: Map<string, number>
  onClose:     () => void
}) {
  const [openSkill, setOpenSkill] = useState<string | null>(null)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bb-dark border border-bb-gold/30 rounded-sm shadow-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-bb-border shrink-0">
          {logo && <img src={logo} alt={team.raceName} className="w-10 h-10 object-contain opacity-90 shrink-0" />}
          <div className="flex-1 min-w-0">
            <h3 className="font-heading font-bold text-bb-gold text-lg leading-tight">{team.name}</h3>
            <p className="text-xs text-bb-muted">{team.raceName} · {players.length} players</p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 w-8 h-8 flex items-center justify-center text-bb-muted hover:text-white transition-colors rounded-sm"
            aria-label="Close"
          >✕</button>
        </div>

        {/* Player list */}
        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {players.length === 0 && (
            <p className="text-bb-muted text-sm italic text-center py-4">No players in lineup.</p>
          )}
          {players.map((p) => (
            <div key={p.id} className="pb-4 border-b border-bb-border/30 last:border-0">
              {/* Name row */}
              <div className="flex items-baseline gap-2 mb-1.5">
                <span className="font-heading text-bb-muted text-xs w-7 shrink-0">#{p.number}</span>
                <span className="text-white font-semibold text-sm">{p.name ?? p.playerTypeName}</span>
                <span className="text-bb-muted/60 text-xs italic truncate">{p.playerTypeName}</span>
                {p.status === 'MNG' && (
                  <span className="ml-auto shrink-0 text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/40 px-1.5 py-0.5 rounded-sm font-heading">MNG</span>
                )}
              </div>

              {/* Stats */}
              <div className="flex gap-4 text-[11px] font-mono mb-1.5 ml-7">
                {[['MA', p.ma], ['ST', p.st], ['AG', p.ag], ['AV', p.av]].map(([label, val]) => (
                  <span key={label as string} className="text-bb-muted">
                    <span className="text-bb-muted/50">{label} </span>{val}
                  </span>
                ))}
              </div>

              {/* SSP & Level */}
              {(() => {
                const matchSsp = matchSspMap.get(p.id) ?? 0
                const totalSsp = p.ssp + matchSsp
                const { levelName, toNext, nearPromotion } = getSspInfo(totalSsp)
                return (
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1 ml-7 mb-2">
                    <span className="text-[11px] text-bb-muted/50 font-heading">SSP</span>
                    <span className="text-[11px] font-mono text-bb-muted">{totalSsp}</span>
                    {matchSsp > 0 && (
                      <span className="text-[11px] text-bb-gold/70">(+{matchSsp} this match)</span>
                    )}
                    <span className={`text-[10px] font-heading uppercase tracking-wider px-1.5 py-0.5 rounded-sm border ${
                      nearPromotion
                        ? 'border-bb-gold text-bb-gold bg-bb-gold/10'
                        : 'border-bb-border/40 text-bb-muted/50'
                    }`}>{levelName}</span>
                    {nearPromotion && toNext !== null && (
                      <span className="text-[10px] text-bb-gold animate-pulse">↑ {toNext} to next level</span>
                    )}
                  </div>
                )
              })()}

              {/* Skills — tap to expand rule */}
              {p.skills.length > 0 && (
                <div className="ml-7 space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {p.skills.map((skill) => {
                      const key    = `${p.id}||${skill.name}`
                      const isOpen = openSkill === key
                      return (
                        <button
                          key={skill.name}
                          onClick={() => setOpenSkill(isOpen ? null : key)}
                          className={`text-[11px] px-2.5 py-1 rounded-sm border transition-colors touch-manipulation min-h-[32px] ${
                            isOpen
                              ? 'border-bb-gold text-bb-gold bg-bb-gold/10'
                              : 'border-bb-border/60 text-bb-muted hover:border-bb-gold/40 hover:text-bb-gold/70 active:bg-bb-gold/5'
                          }`}
                        >
                          {skill.name}
                        </button>
                      )
                    })}
                  </div>
                  {/* Expanded rule */}
                  {openSkill && openSkill.startsWith(`${p.id}||`) && (() => {
                    const skillName = openSkill.split('||')[1]
                    const skill     = p.skills.find((s) => s.name === skillName)
                    return skill ? (
                      <div className="text-[11px] text-bb-muted/90 leading-relaxed bg-bb-darker border border-bb-border/40 rounded-sm px-3 py-2.5">
                        <span className="text-bb-gold font-heading text-[10px] uppercase tracking-wider block mb-1">{skill.name}</span>
                        {skill.rule}
                      </div>
                    ) : null
                  })()}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  matchData: MatchData
}

export default function GameOnClient({ matchData }: Props) {
  const [isPending, startTransition]   = useTransition()
  const [, persistTransition]          = useTransition()

  const homeLogo = getRaceLogo(matchData.homeTeam.raceName)
  const awayLogo = getRaceLogo(matchData.awayTeam.raceName)

  const defaultState = (): GameState => ({
    phase: matchData.status === 'LIVE' ? 'live' : 'prematch',
    turn:  1,
    lineup: {
      home: matchData.homeTeam.players.filter((p) => p.status === 'ACTIVE').map((p) => p.id),
      away: matchData.awayTeam.players.filter((p) => p.status === 'ACTIVE').map((p) => p.id),
    },
    events:          [],
    mvp:             { home: null, away: null },
    winnings:        { home: 0, away: 0 },
    injuryOverrides: {},
  })

  const [state, setState]       = useState<GameState>(defaultState)
  const [modal, setModal]       = useState<ModalState>(null)
  const [hydrated, setHydrated] = useState(false)
  const [rosterSide, setRosterSide] = useState<'home' | 'away' | null>(null)

  // Restore from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem(`match-${matchData.id}`)
    if (saved) {
      try { setState(JSON.parse(saved)) } catch {}
    }
    setHydrated(true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Persist to localStorage on every state change (after hydration)
  useEffect(() => {
    if (hydrated) {
      localStorage.setItem(`match-${matchData.id}`, JSON.stringify(state))
    }
  }, [state, matchData.id, hydrated])

  // Derived values
  const allPlayers = useMemo(
    () => [...matchData.homeTeam.players, ...matchData.awayTeam.players],
    [matchData],
  )
  const playerById = useMemo(
    () => new Map(allPlayers.map((p) => [p.id, p])),
    [allPlayers],
  )
  const playerTeam = useMemo(
    () => new Map<string, 'home' | 'away'>([
      ...matchData.homeTeam.players.map((p): [string, 'home'] => [p.id, 'home']),
      ...matchData.awayTeam.players.map((p): [string, 'away'] => [p.id, 'away']),
    ]),
    [matchData],
  )

  const score  = useMemo(() => computeScore(state.events), [state.events])
  const half   = state.turn >= 9 ? 2 : 1

  const matchSspMap = useMemo(() => {
    const map = new Map<string, number>()
    for (const p of allPlayers) {
      const tds  = state.events.filter((e) => e.type === 'TD' && e.scorerId === p.id).length
      const comp = state.events.filter((e) => e.type === 'TD' && e.passerId === p.id).length
      const ints = state.events.filter((e) => e.type === 'INTERCEPTION' && e.interceptorId === p.id).length
      const cas  = state.events.filter((e) => e.type === 'CASUALTY' && e.attackerId === p.id && e.casualtyResult !== 'KO').length
      const mvp  = (state.mvp.home === p.id || state.mvp.away === p.id) ? 5 : 0
      const total = tds * 3 + comp + ints * 2 + cas * 2 + mvp
      if (total > 0) map.set(p.id, total)
    }
    return map
  }, [state.events, state.mvp, allPlayers])

  const homePlaying = useMemo(
    () => matchData.homeTeam.players.filter((p) => state.lineup.home.includes(p.id)),
    [matchData.homeTeam.players, state.lineup.home],
  )
  const awayPlaying = useMemo(
    () => matchData.awayTeam.players.filter((p) => state.lineup.away.includes(p.id)),
    [matchData.awayTeam.players, state.lineup.away],
  )
  const allPlaying = useMemo(() => [...homePlaying, ...awayPlaying], [homePlaying, awayPlaying])

  // ── Event mutators ─────────────────────────────────────────────────────────

  function pushEvent(event: MatchEvent) {
    setState((prev) => ({ ...prev, events: [...prev.events, event] }))
    persistTransition(async () => { await pushMatchEvent(matchData.id, event.type, event.label) })
  }

  function undoLast() {
    setState((prev) => ({ ...prev, events: prev.events.slice(0, -1) }))
    persistTransition(async () => { await deleteLastMatchEvent(matchData.id) })
  }

  // ── Phase transitions ─────────────────────────────────────────────────────

  function handleKickOff() {
    setState((prev) => ({ ...prev, phase: 'live' }))
    startTransition(async () => {
      try { await startMatch(matchData.id) } catch {}
    })
  }

  function handleFullTime() {
    setState((prev) => ({ ...prev, phase: 'postmatch' }))
  }

  function handleComplete() {
    const playerUpdates = computePlayerUpdates(state, allPlayers)
    const fd = new FormData()
    fd.set('payload', JSON.stringify({
      matchId:      matchData.id,
      homeScore:    score.home,
      awayScore:    score.away,
      homeWinnings: state.winnings.home,
      awayWinnings: state.winnings.away,
      playerUpdates,
      events:       state.events.map((e) => ({ type: e.type, label: e.label })),
    }))
    localStorage.removeItem(`match-${matchData.id}`)
    startTransition(() => { completeMatchFull(fd) })
  }

  // ── Modal commit helpers ───────────────────────────────────────────────────

  function commitTD() {
    if (modal?.type !== 'td') return
    const { team, scorerId, passerId, hasPass } = modal
    if (!team || !scorerId) return
    const scorer   = playerById.get(scorerId)
    const passer   = passerId && hasPass ? playerById.get(passerId) : null
    const teamName = team === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const label    = passer
      ? `T${state.turn} · TD · ${playerLabel(scorer!)} (${teamName}) — pass from ${playerLabel(passer)}`
      : `T${state.turn} · TD · ${playerLabel(scorer!)} (${teamName})`
    pushEvent({ id: uid(), type: 'TD', turn: state.turn, scoringTeam: team, scorerId, passerId: passer ? passerId! : undefined, label })
    setModal(null)
  }

  function commitCasualty() {
    if (modal?.type !== 'casualty') return
    const { attackerId, victimId, result } = modal
    if (!attackerId || !victimId || !result) return
    const attacker = playerById.get(attackerId)!
    const victim   = playerById.get(victimId)!
    const atkTeam  = playerTeam.get(attackerId) === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const label    = `T${state.turn} · CAS · ${playerLabel(attacker)} (${atkTeam}) → ${playerLabel(victim)} [${result}]`
    pushEvent({ id: uid(), type: 'CASUALTY', turn: state.turn, attackerId, victimId, casualtyResult: result, label })
    setModal(null)
  }

  function commitInterception() {
    if (modal?.type !== 'interception') return
    const { playerId } = modal
    if (!playerId) return
    const p    = playerById.get(playerId)!
    const team = playerTeam.get(playerId) === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    pushEvent({ id: uid(), type: 'INTERCEPTION', turn: state.turn, interceptorId: playerId, label: `T${state.turn} · INT · ${playerLabel(p)} (${team})` })
    setModal(null)
  }

  // ── Injury victims for Post-Match review ──────────────────────────────────

  const injuredPlayers = useMemo(() => {
    const victims = new Map<string, CasualtyResult>()
    for (const e of state.events) {
      if (e.type === 'CASUALTY' && e.victimId && e.casualtyResult && e.casualtyResult !== 'KO') {
        const existing = victims.get(e.victimId)
        if (!existing || CAS_SEVERITY[e.casualtyResult] > CAS_SEVERITY[existing]) {
          victims.set(e.victimId, e.casualtyResult)
        }
      }
    }
    return [...victims.entries()]
      .map(([id, cas]) => ({ player: playerById.get(id)!, cas }))
      .filter((x) => x.player)
  }, [state.events, playerById])

  // ── Common UI atoms ───────────────────────────────────────────────────────

  const btnCrimson = 'flex items-center gap-2 px-4 py-3 rounded-sm border border-bb-crimson/60 bg-bb-crimson/10 text-bb-crimson hover:bg-bb-crimson hover:text-white transition-colors font-heading tracking-widest text-xs uppercase'
  const btnGold    = 'flex items-center gap-2 px-4 py-3 rounded-sm border border-bb-gold/60 bg-bb-gold/10 text-bb-gold hover:bg-bb-gold hover:text-bb-dark transition-colors font-heading tracking-widest text-xs uppercase'
  const btnGhost   = 'px-4 py-2 rounded-sm border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted transition-colors text-xs font-heading uppercase tracking-widest'

  function SelectPlayer({
    players, value, onChange, placeholder,
  }: { players: MatchPlayer[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
    return (
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold"
      >
        <option value="">{placeholder ?? 'Select player…'}</option>
        {players.map((p) => (
          <option key={p.id} value={p.id}>{playerLabelFull(p)}</option>
        ))}
      </select>
    )
  }

  // ── Modal overlay ─────────────────────────────────────────────────────────

  function ModalOverlay({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
           onClick={onClose}>
        <div className="w-full max-w-md bg-bb-dark border border-bb-gold/30 rounded-sm shadow-2xl"
             onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between px-5 py-4 border-b border-bb-border">
            <h3 className="font-heading text-lg font-bold text-bb-gold">{title}</h3>
            <button onClick={onClose} className="text-bb-muted hover:text-white transition-colors">✕</button>
          </div>
          <div className="px-5 py-5 space-y-4">
            {children}
          </div>
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 1 — PRE-MATCH
  // ─────────────────────────────────────────────────────────────────────────

  if (state.phase === 'prematch') {
    function togglePlayer(side: 'home' | 'away', playerId: string) {
      setState((prev) => {
        const list    = prev.lineup[side]
        const updated = list.includes(playerId) ? list.filter((id) => id !== playerId) : [...list, playerId]
        return { ...prev, lineup: { ...prev.lineup, [side]: updated } }
      })
    }

    return (
      <div className="min-h-screen bg-bb-darker text-white flex flex-col">
        {/* Header */}
        <div className="bg-bb-dark border-b border-bb-border px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-xs text-bb-gold/60 font-heading uppercase tracking-widest">Round {matchData.round}</span>
            <h1 className="font-heading text-2xl font-black text-white mt-0.5">Pre-Match Lineup</h1>
          </div>
          <div className="text-right">
            <p className="text-xs text-bb-muted">Check players who are playing today.</p>
            <p className="text-xs text-bb-muted">MNG players are unchecked by default.</p>
          </div>
        </div>

        {/* Rosters */}
        <div className="flex-1 grid grid-cols-2 divide-x divide-bb-border overflow-auto">
          {(['home', 'away'] as const).map((side) => {
            const team    = side === 'home' ? matchData.homeTeam : matchData.awayTeam
            const logo    = side === 'home' ? homeLogo : awayLogo
            const playing = state.lineup[side]
            return (
              <div key={side} className="p-6">
                <div className="mb-5 flex items-center gap-3">
                  {logo && (
                    <button onClick={() => setRosterSide(side)} title="View roster"
                      className="shrink-0 rounded-sm hover:ring-2 hover:ring-bb-gold/50 transition-all touch-manipulation">
                      <img src={logo} alt={team.raceName} className="w-12 h-12 object-contain opacity-90" />
                    </button>
                  )}
                  <div>
                    <h2 className="font-heading text-xl font-bold text-bb-gold">{team.name}</h2>
                    <p className="text-xs text-bb-muted">{team.raceName}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  {team.players.length === 0 && (
                    <p className="text-bb-muted text-sm italic">No players available.</p>
                  )}
                  {team.players.map((p) => (
                    <label key={p.id}
                      className="flex items-center gap-3 p-2 rounded-sm hover:bg-white/5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={playing.includes(p.id)}
                        onChange={() => togglePlayer(side, p.id)}
                        className="accent-bb-crimson w-4 h-4 shrink-0"
                      />
                      <span className="text-sm text-bb-muted w-6 font-heading">#{p.number}</span>
                      <span className="text-sm text-white flex-1">{p.name ?? p.playerTypeName}</span>
                      <span className="text-xs text-bb-muted/60 italic">{p.playerTypeName}</span>
                      {p.status === 'MNG' && (
                        <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/40 px-1.5 py-0.5 rounded-sm font-heading">MNG</span>
                      )}
                    </label>
                  ))}
                </div>
              </div>
            )
          })}
        </div>

        {/* Footer */}
        <div className="bg-bb-dark border-t border-bb-border px-6 py-4 flex items-center justify-end gap-4">
          <span className="text-sm text-bb-muted">
            {state.lineup.home.length} home · {state.lineup.away.length} away
          </span>
          <button onClick={handleKickOff} disabled={isPending}
            className="px-8 py-3 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-50">
            ⚔ Kick Off!
          </button>
        </div>

        {rosterSide && (
          <RosterModal
            team={rosterSide === 'home' ? matchData.homeTeam : matchData.awayTeam}
            players={rosterSide === 'home' ? matchData.homeTeam.players : matchData.awayTeam.players}
            logo={rosterSide === 'home' ? homeLogo : awayLogo}
            matchSspMap={matchSspMap}
            onClose={() => setRosterSide(null)}
          />
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 2 — LIVE MATCH
  // ─────────────────────────────────────────────────────────────────────────

  if (state.phase === 'live') {
    const hasHalftime = state.events.some((e) => e.type === 'HALFTIME')

    return (
      <div className="min-h-screen bg-bb-darker text-white flex flex-col">
        {/* Sticky scoreboard header */}
        <div className="sticky top-0 z-10 bg-bb-dark border-b border-bb-border px-4 sm:px-6 py-3 flex items-center gap-3">
          {homeLogo && (
            <button onClick={() => setRosterSide('home')} title="View home roster"
              className="shrink-0 rounded-sm hover:ring-2 hover:ring-bb-gold/50 transition-all touch-manipulation">
              <img src={homeLogo} alt={matchData.homeTeam.raceName} className="w-10 h-10 object-contain opacity-90" />
            </button>
          )}
          <div className="flex-1 text-center">
            <div className="text-xs text-bb-muted font-heading uppercase tracking-widest mb-0.5">{matchData.homeTeam.name}</div>
            <div className="font-heading text-4xl font-black text-bb-gold">{score.home}</div>
          </div>
          <div className="shrink-0 text-center">
            <div className="text-bb-muted text-[10px] font-heading tracking-widest uppercase mb-0.5">
              {half === 1 ? '1st Half' : '2nd Half'}
            </div>
            <div className="text-white font-heading text-lg font-bold">–</div>
            <div className="flex items-center justify-center gap-1 mt-1">
              <button
                onClick={() => setState((prev) => ({ ...prev, turn: Math.max(1, prev.turn - 1) }))}
                disabled={state.turn <= 1}
                className="w-5 h-5 flex items-center justify-center text-bb-muted hover:text-white disabled:opacity-20 transition-colors text-xs leading-none"
                aria-label="Previous turn"
              >‹</button>
              <span className="text-[11px] font-heading text-bb-muted/80 min-w-[36px] text-center">
                T {state.turn}
              </span>
              <button
                onClick={() => setState((prev) => ({ ...prev, turn: Math.min(16, prev.turn + 1) }))}
                disabled={state.turn >= 16}
                className="w-5 h-5 flex items-center justify-center text-bb-muted hover:text-white disabled:opacity-20 transition-colors text-xs leading-none"
                aria-label="Next turn"
              >›</button>
            </div>
          </div>
          <div className="flex-1 text-center">
            <div className="text-xs text-bb-muted font-heading uppercase tracking-widest mb-0.5">{matchData.awayTeam.name}</div>
            <div className="font-heading text-4xl font-black text-bb-gold">{score.away}</div>
          </div>
          {awayLogo && (
            <button onClick={() => setRosterSide('away')} title="View away roster"
              className="shrink-0 rounded-sm hover:ring-2 hover:ring-bb-gold/50 transition-all touch-manipulation">
              <img src={awayLogo} alt={matchData.awayTeam.raceName} className="w-10 h-10 object-contain opacity-90" />
            </button>
          )}
        </div>

        {/* Main area */}
        <div className="flex-1 grid grid-cols-[280px_1fr] overflow-hidden">
          {/* Left: action buttons */}
          <div className="border-r border-bb-border p-4 flex flex-col gap-3 overflow-y-auto">
            <p className="text-[10px] text-bb-muted/50 font-heading uppercase tracking-widest mb-1">Record Event</p>

            <button onClick={() => setModal({ type: 'td', step: 1, team: null, scorerId: null, hasPass: false, passerId: null })}
              className={btnCrimson}>
              <span className="text-base">🏈</span> Touchdown
            </button>

            <button onClick={() => setModal({ type: 'casualty', step: 1, attackTeam: null, attackerId: null, victimId: null, result: null })}
              className={btnCrimson}>
              <span className="text-base">💀</span> Casualty
            </button>

            <button onClick={() => setModal({ type: 'interception', step: 1, team: null, playerId: null })}
              className={btnGhost + ' text-left'}>
              <span className="text-base">🖐</span> Interception
            </button>

            <div className="mt-auto space-y-2 pt-4 border-t border-bb-border">
              {!hasHalftime && (
                <button onClick={() => {
                  pushEvent({ id: uid(), type: 'HALFTIME', label: '─── Half Time ───' })
                }} className={btnGhost + ' w-full justify-center'}>
                  ⛔ Half Time
                </button>
              )}
              <button onClick={handleFullTime}
                className="w-full px-4 py-3 bg-bb-gold text-bb-dark font-heading font-bold tracking-widest uppercase rounded-sm text-xs hover:brightness-110 transition-all">
                ■ Full Time
              </button>
            </div>
          </div>

          {/* Right: event log */}
          <div className="flex flex-col overflow-hidden">
            <div className="px-5 py-3 border-b border-bb-border flex items-center justify-between shrink-0">
              <p className="text-[10px] text-bb-muted/50 font-heading uppercase tracking-widest">Match Log</p>
              {state.events.length > 0 && (
                <button onClick={undoLast}
                  className="text-[10px] text-bb-muted hover:text-bb-crimson transition-colors font-heading uppercase tracking-widest">
                  ↩ Undo Last
                </button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-3 space-y-1.5 flex flex-col-reverse">
              <div className="space-y-1.5">
                {state.events.length === 0 && (
                  <p className="text-bb-muted text-sm italic text-center py-8">No events recorded yet.</p>
                )}
                {[...state.events].reverse().map((event, i) => (
                  <div key={event.id}
                    className={`px-3 py-2 rounded-sm text-sm border ${
                      event.type === 'HALFTIME'
                        ? 'border-bb-border/30 text-bb-muted/50 text-center italic text-xs'
                        : event.type === 'TD'
                        ? 'border-bb-gold/30 bg-bb-gold/5 text-white'
                        : event.type === 'CASUALTY'
                        ? 'border-bb-crimson/30 bg-bb-crimson/5 text-white'
                        : 'border-bb-border/50 text-bb-muted'
                    }`}>
                    {event.label}
                    {i === 0 && event.type !== 'HALFTIME' && (
                      <span className="ml-2 text-[10px] text-bb-muted/40 font-heading">← latest</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* TD Modal */}
        {modal?.type === 'td' && (
          <ModalOverlay title="Record Touchdown" onClose={() => setModal(null)}>
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team scored?</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['home', 'away'] as const).map((side) => {
                    const team = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    return (
                      <button key={side} onClick={() => setModal({ ...modal, step: 2, team: side })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-gold hover:bg-bb-gold/5 transition-colors text-center">
                        <div className="font-heading font-bold text-white text-sm">{team.name}</div>
                        <div className="text-xs text-bb-muted mt-1">{team.raceName}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {modal.step === 2 && modal.team && (
              <>
                <p className="text-bb-muted text-sm">Who scored?</p>
                <SelectPlayer
                  players={modal.team === 'home' ? homePlaying : awayPlaying}
                  value={modal.scorerId ?? ''}
                  onChange={(v) => setModal({ ...modal, scorerId: v })}
                  placeholder="Select scorer…"
                />
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 1 })} className={btnGhost}>← Back</button>
                  <button onClick={() => setModal({ ...modal, step: 3 })} disabled={!modal.scorerId}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Next →
                  </button>
                </div>
              </>
            )}
            {modal.step === 3 && (
              <>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={modal.hasPass}
                    onChange={(e) => setModal({ ...modal, hasPass: e.target.checked, passerId: null })}
                    className="accent-bb-crimson w-4 h-4" />
                  <span className="text-sm text-white">Off a passing completion?</span>
                </label>
                {modal.hasPass && (
                  <SelectPlayer
                    players={(modal.team === 'home' ? homePlaying : awayPlaying).filter((p) => p.id !== modal.scorerId)}
                    value={modal.passerId ?? ''}
                    onChange={(v) => setModal({ ...modal, passerId: v })}
                    placeholder="Select passer…"
                  />
                )}
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 2 })} className={btnGhost}>← Back</button>
                  <button onClick={commitTD}
                    disabled={modal.hasPass && !modal.passerId}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Confirm TD
                  </button>
                </div>
              </>
            )}
          </ModalOverlay>
        )}

        {/* Casualty Modal */}
        {modal?.type === 'casualty' && (
          <ModalOverlay title="Record Casualty" onClose={() => setModal(null)}>
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team caused the casualty?</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['home', 'away'] as const).map((side) => {
                    const team = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    return (
                      <button key={side} onClick={() => setModal({ ...modal, step: 2, attackTeam: side })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-crimson hover:bg-bb-crimson/5 transition-colors text-center">
                        <div className="font-heading font-bold text-white text-sm">{team.name}</div>
                        <div className="text-xs text-bb-muted mt-1">{team.raceName}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {modal.step === 2 && modal.attackTeam && (
              <>
                <p className="text-bb-muted text-sm">Who caused the casualty?</p>
                <SelectPlayer
                  players={modal.attackTeam === 'home' ? homePlaying : awayPlaying}
                  value={modal.attackerId ?? ''}
                  onChange={(v) => setModal({ ...modal, attackerId: v })}
                  placeholder="Select attacker…"
                />
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 1 })} className={btnGhost}>← Back</button>
                  <button onClick={() => setModal({ ...modal, step: 3 })} disabled={!modal.attackerId}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Next →
                  </button>
                </div>
              </>
            )}
            {modal.step === 3 && (
              <>
                <p className="text-bb-muted text-sm">Who was injured?</p>
                {/* Grouped by team so home/away players are clearly separated */}
                <select
                  value={modal.victimId ?? ''}
                  onChange={(e) => setModal({ ...modal, victimId: e.target.value })}
                  className="w-full bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold"
                >
                  <option value="">Select victim…</option>
                  {(['home', 'away'] as const).map((side) => {
                    const team    = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    const players = (side === 'home' ? homePlaying : awayPlaying).filter((p) => p.id !== modal.attackerId)
                    if (players.length === 0) return null
                    return (
                      <optgroup key={side} label={`── ${team.name} ──`}>
                        {players.map((p) => (
                          <option key={p.id} value={p.id}>{playerLabelFull(p)}</option>
                        ))}
                      </optgroup>
                    )
                  })}
                </select>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 2 })} className={btnGhost}>← Back</button>
                  <button onClick={() => setModal({ ...modal, step: 4 })} disabled={!modal.victimId}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Next →
                  </button>
                </div>
              </>
            )}
            {modal.step === 4 && (
              <>
                <p className="text-bb-muted text-sm">Injury result:</p>
                <div className="grid grid-cols-2 gap-2">
                  {(['KO', 'BH', 'MNG', 'DEAD'] as CasualtyResult[]).map((r) => (
                    <button key={r} onClick={() => setModal({ ...modal, result: r })}
                      className={`p-3 rounded-sm border text-sm font-heading font-bold uppercase tracking-wider transition-colors ${
                        modal.result === r
                          ? 'bg-bb-crimson border-bb-crimson text-white'
                          : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'
                      }`}>
                      {r === 'KO' ? '🌀 KO' : r === 'BH' ? '🤕 Badly Hurt' : r === 'MNG' ? '🏥 MNG' : '💀 Dead'}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 3 })} className={btnGhost}>← Back</button>
                  <button onClick={commitCasualty} disabled={!modal.result}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Confirm
                  </button>
                </div>
              </>
            )}
          </ModalOverlay>
        )}

        {/* Interception Modal */}
        {modal?.type === 'interception' && (
          <ModalOverlay title="Record Interception" onClose={() => setModal(null)}>
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team made the interception?</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['home', 'away'] as const).map((side) => {
                    const team = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    return (
                      <button key={side} onClick={() => setModal({ ...modal, step: 2, team: side })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors text-center">
                        <div className="font-heading font-bold text-white text-sm">{team.name}</div>
                        <div className="text-xs text-bb-muted mt-1">{team.raceName}</div>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
            {modal.step === 2 && modal.team && (
              <>
                <p className="text-bb-muted text-sm">Who made the interception?</p>
                <SelectPlayer
                  players={modal.team === 'home' ? homePlaying : awayPlaying}
                  value={modal.playerId ?? ''}
                  onChange={(v) => setModal({ ...modal, playerId: v })}
                />
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 1 })} className={btnGhost}>← Back</button>
                  <button onClick={commitInterception} disabled={!modal.playerId}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Confirm
                  </button>
                </div>
              </>
            )}
          </ModalOverlay>
        )}

        {rosterSide && (
          <RosterModal
            team={rosterSide === 'home' ? matchData.homeTeam : matchData.awayTeam}
            players={rosterSide === 'home' ? homePlaying : awayPlaying}
            logo={rosterSide === 'home' ? homeLogo : awayLogo}
            matchSspMap={matchSspMap}
            onClose={() => setRosterSide(null)}
          />
        )}
      </div>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PHASE 3 — POST-MATCH
  // ─────────────────────────────────────────────────────────────────────────

  const playerUpdates = computePlayerUpdates(state, allPlayers)
  const statsPlayers  = playerUpdates.filter(
    (u) => u.deltaTouchdowns || u.deltaCompletePasses || u.deltaInterceptions || u.deltaCasualties || u.deltaMVP,
  )

  return (
    <div className="min-h-screen bg-bb-darker text-white">
      {/* Header */}
      <div className="bg-bb-dark border-b border-bb-border px-6 py-5 text-center">
        <p className="text-xs text-bb-muted font-heading uppercase tracking-widest mb-2">Final Score · Round {matchData.round}</p>
        <div className="flex items-center justify-center gap-4 sm:gap-6">
          {homeLogo && (
            <button onClick={() => setRosterSide('home')} title="View home roster"
              className="shrink-0 rounded-sm hover:ring-2 hover:ring-bb-gold/50 transition-all touch-manipulation">
              <img src={homeLogo} alt={matchData.homeTeam.raceName} className="w-14 h-14 object-contain opacity-90" />
            </button>
          )}
          <div className="text-right">
            <p className="text-lg font-bold text-white">{matchData.homeTeam.name}</p>
            <p className="text-xs text-bb-muted">{matchData.homeTeam.raceName}</p>
          </div>
          <div className="font-heading text-5xl font-black text-bb-gold px-4">
            {score.home} – {score.away}
          </div>
          <div className="text-left">
            <p className="text-lg font-bold text-white">{matchData.awayTeam.name}</p>
            <p className="text-xs text-bb-muted">{matchData.awayTeam.raceName}</p>
          </div>
          {awayLogo && (
            <button onClick={() => setRosterSide('away')} title="View away roster"
              className="shrink-0 rounded-sm hover:ring-2 hover:ring-bb-gold/50 transition-all touch-manipulation">
              <img src={awayLogo} alt={matchData.awayTeam.raceName} className="w-14 h-14 object-contain opacity-90" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">

        {/* MVP Selection */}
        <section className="bg-bb-dark border border-bb-border rounded-sm p-5">
          <h2 className="font-heading text-base font-bold text-bb-gold mb-4 uppercase tracking-widest">
            ⭐ Most Valuable Players
          </h2>
          <div className="grid grid-cols-2 gap-4">
            {(['home', 'away'] as const).map((side) => {
              const team    = side === 'home' ? matchData.homeTeam : matchData.awayTeam
              const playing = side === 'home' ? homePlaying : awayPlaying
              return (
                <div key={side}>
                  <label className="block text-xs text-bb-muted mb-1.5 font-heading uppercase tracking-wider">{team.name}</label>
                  <SelectPlayer
                    players={playing}
                    value={state.mvp[side] ?? ''}
                    onChange={(v) => setState((prev) => ({ ...prev, mvp: { ...prev.mvp, [side]: v || null } }))}
                    placeholder="No MVP"
                  />
                </div>
              )
            })}
          </div>
        </section>

        {/* Injury Confirmation */}
        {injuredPlayers.length > 0 && (
          <section className="bg-bb-dark border border-bb-border rounded-sm p-5">
            <h2 className="font-heading text-base font-bold text-bb-gold mb-1 uppercase tracking-widest">
              🏥 Injury Confirmation
            </h2>
            <p className="text-xs text-bb-muted mb-4">Confirm or correct the lasting injury status for each player.</p>
            <div className="space-y-2">
              {injuredPlayers.map(({ player, cas }) => {
                const override  = state.injuryOverrides[player.id]
                const effective = override ?? cas
                return (
                  <div key={player.id} className="flex items-center gap-3 p-3 bg-bb-darker rounded-sm">
                    <span className="flex-1 text-sm text-white">{playerLabelFull(player)}</span>
                    <select
                      value={effective}
                      onChange={(e) => {
                        const v = e.target.value as 'BH' | 'MNG' | 'DEAD'
                        setState((prev) => ({
                          ...prev,
                          injuryOverrides: { ...prev.injuryOverrides, [player.id]: v as 'BH' | 'MNG' | 'DEAD' },
                        }))
                      }}
                      className="bg-bb-dark border border-bb-border rounded-sm px-3 py-1.5 text-sm text-white focus:outline-none focus:border-bb-gold">
                      <option value="BH">Badly Hurt (no lasting effect)</option>
                      <option value="MNG">Miss Next Game</option>
                      <option value="DEAD">Dead</option>
                    </select>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Winnings */}
        <section className="bg-bb-dark border border-bb-border rounded-sm p-5">
          <h2 className="font-heading text-base font-bold text-bb-gold mb-1 uppercase tracking-widest">
            💰 Match Winnings
          </h2>
          <p className="text-xs text-bb-muted mb-4">Gold pieces to add to each team&apos;s treasury.</p>
          <div className="grid grid-cols-2 gap-4">
            {(['home', 'away'] as const).map((side) => {
              const team = side === 'home' ? matchData.homeTeam : matchData.awayTeam
              return (
                <div key={side}>
                  <label className="block text-xs text-bb-muted mb-1.5 font-heading uppercase tracking-wider">{team.name}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min={0}
                      step={10000}
                      value={state.winnings[side]}
                      onChange={(e) => {
                        const v = parseInt(e.target.value, 10) || 0
                        setState((prev) => ({ ...prev, winnings: { ...prev.winnings, [side]: v } }))
                      }}
                      className="w-full bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold"
                    />
                    <span className="text-xs text-bb-muted shrink-0">gp</span>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* Player Stats Preview */}
        {statsPlayers.length > 0 && (
          <section className="bg-bb-dark border border-bb-border rounded-sm p-5">
            <h2 className="font-heading text-base font-bold text-bb-gold mb-4 uppercase tracking-widest">
              📊 Player Statistics
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] text-bb-muted font-heading uppercase tracking-widest border-b border-bb-border">
                    <th className="text-left py-2 pr-3">Player</th>
                    <th className="text-center px-2">TD</th>
                    <th className="text-center px-2">Comp</th>
                    <th className="text-center px-2">Int</th>
                    <th className="text-center px-2">Cas</th>
                    <th className="text-center px-2">MVP</th>
                    <th className="text-center px-2">SSP</th>
                    <th className="text-left px-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {statsPlayers.map((u) => {
                    const p = playerById.get(u.playerId)
                    if (!p) return null
                    return (
                      <tr key={u.playerId} className="border-b border-bb-border/30 hover:bg-white/3">
                        <td className="py-2 pr-3 text-white">{playerLabel(p)}</td>
                        <td className="text-center px-2 text-bb-gold">{u.deltaTouchdowns || '–'}</td>
                        <td className="text-center px-2 text-bb-muted">{u.deltaCompletePasses || '–'}</td>
                        <td className="text-center px-2 text-bb-muted">{u.deltaInterceptions || '–'}</td>
                        <td className="text-center px-2 text-bb-muted">{u.deltaCasualties || '–'}</td>
                        <td className="text-center px-2 text-bb-gold">{u.deltaMVP ? '⭐' : '–'}</td>
                        <td className="text-center px-2 font-bold text-bb-crimson-bright">+{u.deltaSSP}</td>
                        <td className="px-2">
                          {u.newStatus === 'DEAD' && <span className="text-xs bg-bb-crimson/20 text-bb-crimson px-2 py-0.5 rounded-sm">💀 Dead</span>}
                          {u.newStatus === 'MNG'  && <span className="text-xs bg-amber-900/30 text-amber-400 px-2 py-0.5 rounded-sm">🏥 MNG</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Complete button */}
        <div className="flex justify-center pb-8">
          <button
            onClick={handleComplete}
            disabled={isPending}
            className="px-8 py-4 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-50 shadow-lg shadow-bb-crimson/20">
            {isPending ? 'Saving…' : '⚔ Complete Match & Save Everything'}
          </button>
        </div>
      </div>

      {rosterSide && (
        <RosterModal
          team={rosterSide === 'home' ? matchData.homeTeam : matchData.awayTeam}
          players={rosterSide === 'home' ? homePlaying : awayPlaying}
          logo={rosterSide === 'home' ? homeLogo : awayLogo}
          matchSspMap={matchSspMap}
          onClose={() => setRosterSide(null)}
        />
      )}
    </div>
  )
}
