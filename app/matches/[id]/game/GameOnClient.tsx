'use client'

import { useState, useEffect, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { startMatch, completeMatchFull, pushMatchEvent, deleteLastMatchEvent, savePrematchData, hireMerc, removeMerc, hireStarPlayer, removeStarPlayer, hireJourneyman, removeJourneyman, updateJourneymanNumber, hireInducement, removeInducement, markInducementUsed, markApothecaryUsed, rollWeather, commitPettyCash, saveFansAndFame, buySpecialPlayCard, removeSpecialPlayCard, registerSpecialPlayCard, rollKickoff } from './actions'
import { getTeamLogo } from '@/lib/team-logo'
import { getSspInfo } from '@/lib/ssp'
import { spirallingExpenseFor } from '@/lib/spirallingExpenses'
import { computePettyCashReturn } from '@/lib/postMatchFinance'

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase          = 'prematch' | 'live' | 'postmatch'
type CasualtyResult = 'KO' | 'BH' | 'MNG' | 'NIGGLING' | 'DEAD'

export interface MatchSkill {
  name: string
  rule: string
}

export interface MercPlayerType {
  id:       string
  name:     string
  cost:     number
  mercCost: number
  ma:       number
  st:       number
  ag:       number
  av:       number
  skills:   MatchSkill[]
}

export interface StarPlayerEntry {
  id:         string
  name:       string
  price:      number
  ma:         number
  st:         number
  ag:         number
  av:         number
  skills:     MatchSkill[]
  companions: { id: string; name: string }[]
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
  isMerc?:        boolean
  isStarPlayer?:  boolean
  starPlayerId?:  string
  mercCost?:      number
  isJourneyman?:  boolean
}

export interface JourneymanPlayerType {
  id:     string
  name:   string
  cost:   number
  ma:     number
  st:     number
  ag:     number
  av:     number
  skills: MatchSkill[]
}

export interface InducementType {
  id:       string
  name:     string
  maxCount: number
  price:    number
  rule:     string
}

export interface PurchasedInducement {
  id:            string
  inducementId:  string
  name:          string
  cost:          number
  rule:          string
  used:          boolean
  chefHalf1Used: boolean
  chefHalf2Used: boolean
}

export interface MatchTeamData {
  id:       string
  name:     string
  coachId:  string
  raceName: string
  logoUrl:  string | null
  players:  MatchPlayer[]
}

export interface MatchData {
  id:                string
  status:            'SCHEDULED' | 'LIVE'
  round:             number
  wizardDone:        boolean
  homeTeamValue:     number
  awayTeamValue:     number
  homeBaseTeamValue: number
  awayBaseTeamValue: number
  homeTeamTreasury:  number
  awayTeamTreasury:  number
  homeTeamFanFactor: number
  awayTeamFanFactor: number
  homeCheerleaders:     number
  awayCheerleaders:     number
  homeAssistantCoaches: number
  awayAssistantCoaches: number
  kickoffTable: { dieRoll: number; name: string; description: string }[]
  homePlayerTypes:   MercPlayerType[]
  awayPlayerTypes:   MercPlayerType[]
  homeJourneymanTypes: JourneymanPlayerType[]
  awayJourneymanTypes: JourneymanPlayerType[]
  homeStarPlayers:   StarPlayerEntry[]
  awayStarPlayers:   StarPlayerEntry[]
  homeInducementTypes: InducementType[]
  awayInducementTypes: InducementType[]
  homeInducementsPurchased: PurchasedInducement[]
  awayInducementsPurchased: PurchasedInducement[]
  homeHasApothecary:  boolean
  awayHasApothecary:  boolean
  homeApothecaryUsed: boolean
  awayApothecaryUsed: boolean
  weather:       { name: string; description: string } | null
  homePettyCash: number
  awayPettyCash: number
  homeFans:      number | null
  awayFans:      number | null
  homeFame:      number | null
  awayFame:      number | null
  spirallingExpenseTiers: { teamValueThreshold: number; expenseAmount: number }[]
  specialPlayDecks: SpecialPlayDeck[]
  homeSpecialPlayCards: SpecialPlayCardSlot[]
  awaySpecialPlayCards: SpecialPlayCardSlot[]
  homeTeam:          MatchTeamData
  awayTeam:          MatchTeamData
}

export interface SpecialPlayDeck {
  id:    string
  name:  string
  price: number
  cards: { id: string; cardLabel: string; name: string; description: string; timing: string; effect: string }[]
}

export interface SpecialPlayCardSlot {
  id:       string
  deckId:   string
  deckName: string
  cost:     number
  cardId:   string | null
  cardName: string | null
  turn:     number | null
}

interface MatchEvent {
  id:             string
  type:           'TD' | 'CASUALTY' | 'INTERCEPTION' | 'HALFTIME' | 'CHEF' | 'SENT_OFF' | 'WEATHER' | 'SPECIAL_CARD' | 'KICKOFF'
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
  events:           MatchEvent[]
  mvp:              { home: string | null; away: string | null }
  injuryOverrides:  Record<string, 'BH' | 'MNG' | 'NIGGLING' | 'DEAD'>   // keyed by playerId
  kickingTeam:      'home' | 'away' | null   // who kicks the NEXT kick-off
  firstKickingTeam: 'home' | 'away' | null   // set once, on the match's first kick-off
  pendingKickoff:   boolean                   // a kick-off must be resolved before play continues
}

type MedicalOption = { kind: 'apothecary' | 'matchInducement'; id?: string; label: string }

type ModalState =
  | { type: 'td';          step: 0 | 1 | 2 | 3; eventTurn: number | null; team: 'home' | 'away' | null; scorerId: string | null; hasPass: boolean; passerId: string | null }
  | { type: 'casualty';    step: 0 | 1 | 2 | 3 | 4 | 5; eventTurn: number | null; attackTeam: 'home' | 'away' | null; attackerId: string | null; victimId: string | null; result: CasualtyResult | null; medical: MedicalOption | null }
  | { type: 'interception'; step: 0 | 1 | 2; eventTurn: number | null; team: 'home' | 'away' | null; playerId: string | null }
  | { type: 'inducements' }
  | { type: 'wizard'; step: 0 | 1 | 2 | 3; eventTurn: number | null; side: 'home' | 'away' | null; spell: 'fireball' | 'lightning' | null; victims: { playerId: string; result: CasualtyResult }[]; pendingPlayerId: string | null; pendingResult: CasualtyResult | null }
  | { type: 'sentoff'; step: 0 | 1 | 2; eventTurn: number | null; team: 'home' | 'away' | null; playerId: string | null; bribeId: string | null; outcome: 'success' | 'failed' | null }
  | { type: 'chef'; half: 1 | 2 | null; side: 'home' | 'away' | null; successes: number | null }
  | { type: 'specialCard'; step: 0 | 1 | 2 | 3; eventTurn: number | null; side: 'home' | 'away' | null; slotId: string | null; cardId: string | null }
  | {
      type: 'kickoff'
      step: 'confirmNeeded' | 'toss' | 'setup' | 'roll' | 'resolve'
      isFirstKickoff:  boolean
      tossWinner:      'home' | 'away' | null
      kickingTeam:     'home' | 'away' | null
      eventTurn:       number | null
      die1:            number | ''
      die2:            number | ''
      // Cheering Fans (6) / Brilliant Coaching (8) — coach-vs-coach D3 comparison
      homeCompareDie:  number | ''
      awayCompareDie:  number | ''
      // Changing Weather (7) — re-roll, reuses the weather table
      weatherDie1:     number | ''
      weatherDie2:     number | ''
      // Riot (3)
      riotTurn:        number | 'none' | ''
      riotD6:          number | ''
      // High Kick (5)
      movedPlayerId:   string | null
      // Blitz! (10)
      turnoverEndedEarly: boolean
      // Throw a Rock (11)
      rockHomeDie:     number | ''
      rockAwayDie:     number | ''
      rockVictimId:    string | null
      rockVictimId2:   string | null   // second victim, only used on a tied roll (both teams hit)
      rockResult:      CasualtyResult | null
      rockResult2:     CasualtyResult | null
      // Pitch Invasion (12)
      stunnedHomeIds:  string[]   // home players Stunned by the away coach's rolls
      stunnedAwayIds:  string[]   // away players Stunned by the home coach's rolls
    }
  | null

interface PlayerUpdate {
  playerId:              string
  deltaTouchdowns:       number
  deltaCompletePasses:   number
  deltaInterceptions:    number
  deltaCasualties:       number
  deltaSSP:              number
  deltaMVP:              number
  deltaNigglingInjuries: number
  newStatus:             'ACTIVE' | 'MNG' | 'DEAD' | null
  isDeathPost:           boolean
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function uid() {
  return Math.random().toString(36).slice(2, 9)
}

function freshKickoffModal(opts: {
  step: 'confirmNeeded' | 'toss' | 'setup'
  isFirstKickoff: boolean
  kickingTeam: 'home' | 'away' | null
}): ModalState {
  return {
    type: 'kickoff',
    step: opts.step,
    isFirstKickoff: opts.isFirstKickoff,
    tossWinner: null,
    kickingTeam: opts.kickingTeam,
    eventTurn: null,
    die1: '', die2: '',
    homeCompareDie: '', awayCompareDie: '',
    weatherDie1: '', weatherDie2: '',
    riotTurn: '', riotD6: '',
    movedPlayerId: null,
    turnoverEndedEarly: false,
    rockHomeDie: '', rockAwayDie: '', rockVictimId: null, rockVictimId2: null, rockResult: null, rockResult2: null,
    stunnedHomeIds: [], stunnedAwayIds: [],
  }
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

const CAS_SEVERITY: Record<CasualtyResult, number> = { KO: 0, BH: 1, MNG: 2, NIGGLING: 2, DEAD: 3 }

const WEATHER_ICON: Record<string, string> = {
  'Sweltering Heat': '🥵',
  'Very Sunny':       '☀️',
  'Nice':             '⛅',
  'Pouring Rain':     '🌧️',
  'Blizzard':         '❄️',
}

function computePlayerUpdates(
  state: GameState,
  allPlayers: MatchPlayer[],
): PlayerUpdate[] {
  const { events, mvp, injuryOverrides } = state
  const lineupSet = new Set(allPlayers.filter((p) => p.status !== 'MNG').map((p) => p.id))
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

    // RAW (CRP1): Mercenaries and Star Players never earn Star Player points other than
    // the MVP award, and can never gain new skills — so their TD/CP/INT/CAS never count.
    const isMercOrStar = p.isMerc
    const deltaMVP = mvpSet.has(p.id) ? 1 : 0

    const deltaTouchdowns     = isMercOrStar ? 0 : events.filter((e) => e.type === 'TD' && e.scorerId === p.id).length
    const deltaCompletePasses = isMercOrStar ? 0 : events.filter((e) => e.type === 'TD' && e.passerId === p.id).length
    const deltaInterceptions  = isMercOrStar ? 0 : events.filter((e) => e.type === 'INTERCEPTION' && e.interceptorId === p.id).length
    const deltaCasualties     = isMercOrStar ? 0 : events.filter(
      (e) => e.type === 'CASUALTY' && e.attackerId === p.id && e.casualtyResult !== 'KO',
    ).length

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
      effectiveCas === 'DEAD'     ? 'DEAD' :
      effectiveCas === 'MNG'      ? 'MNG'  :
      effectiveCas === 'NIGGLING' ? 'MNG'  :
      null

    const deltaNigglingInjuries = !isMercOrStar && effectiveCas === 'NIGGLING' ? 1 : 0
    const isDeathPost = newStatus === 'DEAD'

    if (deltaTouchdowns || deltaCompletePasses || deltaInterceptions || deltaCasualties || deltaMVP || newStatus || deltaNigglingInjuries) {
      updates.push({
        playerId: p.id,
        deltaTouchdowns,
        deltaCompletePasses,
        deltaInterceptions,
        deltaCasualties,
        deltaSSP,
        deltaMVP,
        deltaNigglingInjuries,
        newStatus,
        isDeathPost,
      })
    }
  }

  return updates
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

  const homeLogo = getTeamLogo(matchData.homeTeam.logoUrl, matchData.homeTeam.raceName)
  const awayLogo = getTeamLogo(matchData.awayTeam.logoUrl, matchData.awayTeam.raceName)

  const defaultState = (): GameState => ({
    phase: matchData.status === 'LIVE' ? 'live' : 'prematch',
    turn:  1,
    events:          [],
    mvp:             { home: null, away: null },
    injuryOverrides: {},
    kickingTeam:      null,
    firstKickingTeam: null,
    pendingKickoff:   false,
  })

  const [state, setState]       = useState<GameState>(defaultState)
  const [modal, setModal]       = useState<ModalState>(null)
  const [hydrated, setHydrated] = useState(false)
  const [rosterSide, setRosterSide] = useState<'home' | 'away' | null>(null)

  const router = useRouter()

  type WizardStep = 'weather' | 'petty-gold' | 'lineup' | 'inducements' | 'fans'
  const [wizardStep,     setWizardStep]     = useState<WizardStep>(
    matchData.status !== 'SCHEDULED' || matchData.wizardDone ? 'fans' : 'weather'
  )
  const [homePettyGold,  setHomePettyGold]  = useState(matchData.homePettyCash)
  const [awayPettyGold,  setAwayPettyGold]  = useState(matchData.awayPettyCash)
  const [weatherDie1,    setWeatherDie1]    = useState<number | ''>('')
  const [weatherDie2,    setWeatherDie2]    = useState<number | ''>('')
  const [homeWinDie,       setHomeWinDie]       = useState<number | ''>('')
  const [awayWinDie,       setAwayWinDie]       = useState<number | ''>('')
  const [homeWinRerolled,  setHomeWinRerolled]  = useState(false)
  const [awayWinRerolled,  setAwayWinRerolled]  = useState(false)
  const [homeFansDie1,   setHomeFansDie1]   = useState<number | ''>('')
  const [homeFansDie2,   setHomeFansDie2]   = useState<number | ''>('')
  const [awayFansDie1,   setAwayFansDie1]   = useState<number | ''>('')
  const [awayFansDie2,   setAwayFansDie2]   = useState<number | ''>('')
  const [wizardPending,  startWizardTransition] = useTransition()
  const [mercPending,    startMercTransition]   = useTransition()
  const [induceTabHome,  setInduceTabHome]      = useState<'stars' | 'mercs' | 'items' | 'cards'>('stars')
  const [induceTabAway,  setInduceTabAway]      = useState<'stars' | 'mercs' | 'items' | 'cards'>('stars')
  const [openSkillKey,   setOpenSkillKey]       = useState<string | null>(null)

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

  // Reflect the Weather roll in the local event log as soon as it's rolled (not just on a
  // fresh mount) — `rollWeather` already persists the MatchEvent row itself, this is just for
  // this session's own live display. Guarded by `hydrated` so it runs after any localStorage
  // restore, and checks for an existing entry so it's safe to re-run on every matchData change.
  useEffect(() => {
    if (!hydrated || !matchData.weather) return
    setState((prev) => {
      if (prev.events.some((e) => e.id === 'weather')) return prev
      return {
        ...prev,
        events: [
          { id: 'weather', type: 'WEATHER', label: `🌦️ Weather — ${matchData.weather!.name}: ${matchData.weather!.description}` },
          ...prev.events,
        ],
      }
    })
  }, [hydrated, matchData.weather])

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

  const cas = useMemo(() => ({
    home: state.events.filter(
      (e) => e.type === 'CASUALTY' && e.attackerId &&
        playerTeam.get(e.attackerId) === 'home' &&
        e.casualtyResult !== 'KO'
    ).length,
    away: state.events.filter(
      (e) => e.type === 'CASUALTY' && e.attackerId &&
        playerTeam.get(e.attackerId) === 'away' &&
        e.casualtyResult !== 'KO'
    ).length,
  }), [state.events, playerTeam])

  const kills = useMemo(() => ({
    home: state.events.filter(
      (e) => e.type === 'CASUALTY' && e.attackerId &&
        playerTeam.get(e.attackerId) === 'home' &&
        e.casualtyResult === 'DEAD'
    ).length,
    away: state.events.filter(
      (e) => e.type === 'CASUALTY' && e.attackerId &&
        playerTeam.get(e.attackerId) === 'away' &&
        e.casualtyResult === 'DEAD'
    ).length,
  }), [state.events, playerTeam])

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
    () => matchData.homeTeam.players.filter((p) => p.status !== 'MNG'),
    [matchData.homeTeam.players],
  )
  const awayPlaying = useMemo(
    () => matchData.awayTeam.players.filter((p) => p.status !== 'MNG'),
    [matchData.awayTeam.players],
  )
  const allPlaying = useMemo(() => [...homePlaying, ...awayPlaying], [homePlaying, awayPlaying])

  // FAME for the Kick-Off table: base (Fans roll) + 1 per on-pitch Fan Favourite skill.
  // CRP1 (p.18, Fan Favourite entry): this bonus applies to Kick-Off table results only —
  // NOT to the Post-Game Winnings roll, which always uses the base Fans-roll FAME alone.
  const homeFanFavourites = useMemo(
    () => homePlaying.filter((p) => p.skills.some((s) => s.name === 'Fan Favourite')).length,
    [homePlaying],
  )
  const awayFanFavourites = useMemo(
    () => awayPlaying.filter((p) => p.skills.some((s) => s.name === 'Fan Favourite')).length,
    [awayPlaying],
  )
  const homeKickoffFame = (matchData.homeFame ?? 0) + homeFanFavourites
  const awayKickoffFame = (matchData.awayFame ?? 0) + awayFanFavourites

  // ── Event mutators ─────────────────────────────────────────────────────────

  function pushEvent(event: MatchEvent) {
    setState((prev) => ({ ...prev, events: [...prev.events, event] }))
    persistTransition(async () => { await pushMatchEvent(matchData.id, event.type, event.label, event.scoringTeam) })
  }

  function undoLast() {
    setState((prev) => ({ ...prev, events: prev.events.slice(0, -1) }))
    persistTransition(async () => { await deleteLastMatchEvent(matchData.id) })
  }

  // ── Phase transitions ─────────────────────────────────────────────────────

  function handleFullTime() {
    setState((prev) => ({ ...prev, phase: 'postmatch' }))
  }

  function handleComplete() {
    const allUpdates = computePlayerUpdates(state, allPlayers)

    const homeWon  = score.home > score.away
    const awayWon  = score.away > score.home
    const isDraw   = score.home === score.away
    const homeWinnings = (matchData.homeFame !== null && homeWinDie !== '')
      ? (homeWinDie + matchData.homeFame) * 10000 + (homeWon || isDraw ? 10000 : 0)
      : 0
    const awayWinnings = (matchData.awayFame !== null && awayWinDie !== '')
      ? (awayWinDie + matchData.awayFame) * 10000 + (awayWon || isDraw ? 10000 : 0)
      : 0

    // Roster players (real TeamPlayer rows): full career-stat increments, as before.
    const playerUpdates = allUpdates.filter((u) => {
      const p = playerById.get(u.playerId)
      return p && !p.isMerc && !p.isJourneyman
    })

    // Journeymen (MatchJourneyman rows): same full crediting, but persisted on the journeyman
    // record itself so it can be carried over if the coach signs them to the roster post-match.
    const journeymanUpdates = allUpdates
      .filter((u) => playerById.get(u.playerId)?.isJourneyman)
      .map((u) => ({
        id:             u.playerId,
        deltaTouchdowns: u.deltaTouchdowns,
        deltaCompletePasses: u.deltaCompletePasses,
        deltaInterceptions: u.deltaInterceptions,
        deltaCasualties: u.deltaCasualties,
        deltaMVP:       u.deltaMVP,
        deltaSSP:       u.deltaSSP,
        injuryStatus:   u.newStatus ?? 'ACTIVE',
      }))

    // Mercs/Star Players (MatchMerc/MatchStarPlayer rows): MVP only, per RAW — never skill up.
    const mercUpdates = allUpdates
      .filter((u) => { const p = playerById.get(u.playerId); return p?.isMerc && !p.isStarPlayer })
      .map((u) => ({ id: u.playerId, deltaMVP: u.deltaMVP }))
    const starUpdates = allUpdates
      .filter((u) => { const p = playerById.get(u.playerId); return p?.isMerc && p.isStarPlayer })
      .map((u) => ({ id: u.playerId, deltaMVP: u.deltaMVP }))

    // Per-match stat snapshot for roster players, so it can be shown on the match report
    // and a player's match history, distinct from their cumulative career totals.
    const rosterStatRows = playerUpdates.map((u) => ({
      playerId:       u.playerId,
      touchdowns:     u.deltaTouchdowns,
      completePasses: u.deltaCompletePasses,
      interceptions:  u.deltaInterceptions,
      casualties:     u.deltaCasualties,
      mvp:            u.deltaMVP,
      ssp:            u.deltaSSP,
    }))

    const fd = new FormData()
    fd.set('payload', JSON.stringify({
      matchId:      matchData.id,
      homeScore:    score.home,
      awayScore:    score.away,
      homeWinnings,
      awayWinnings,
      playerUpdates,
      journeymanUpdates,
      mercUpdates,
      starUpdates,
      rosterStatRows,
      events:       state.events.map((e) => ({ type: e.type, label: e.label })),
    }))
    localStorage.removeItem(`match-${matchData.id}`)
    startTransition(() => { completeMatchFull(fd) })
  }

  // ── Modal commit helpers ───────────────────────────────────────────────────

  function commitTD() {
    if (modal?.type !== 'td') return
    const { team, scorerId, passerId, hasPass, eventTurn } = modal
    if (!team || !scorerId || !eventTurn) return
    const scorer   = playerById.get(scorerId)
    const passer   = passerId && hasPass ? playerById.get(passerId) : null
    const teamName = team === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const label    = passer
      ? `T${eventTurn} · TD · ${playerLabel(scorer!)} (${teamName}) — pass from ${playerLabel(passer)}`
      : `T${eventTurn} · TD · ${playerLabel(scorer!)} (${teamName})`
    pushEvent({ id: uid(), type: 'TD', turn: eventTurn, scoringTeam: team, scorerId, passerId: passer ? passerId! : undefined, label })
    // CRP1: the scoring team always kicks off next, if the half isn't over.
    setModal(freshKickoffModal({ step: 'confirmNeeded', isFirstKickoff: false, kickingTeam: team }))
  }

  function pushKickoffEvent(event: MatchEvent, dieRoll: number) {
    setState((prev) => ({ ...prev, events: [...prev.events, event] }))
    persistTransition(async () => { await rollKickoff(matchData.id, dieRoll, event.label) })
  }

  function commitKickoff() {
    if (modal?.type !== 'kickoff') return
    const m = modal
    if (!m.kickingTeam || m.die1 === '' || m.die2 === '') return
    const dieRoll = m.die1 + m.die2
    const result = matchData.kickoffTable.find((r) => r.dieRoll === dieRoll)
    if (!result) return

    const receivingTeam = m.kickingTeam === 'home' ? 'away' : 'home'
    const kickingName   = m.kickingTeam === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const receivingName = receivingTeam === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const teamName = (side: 'home' | 'away') => side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name

    let detail = ''

    if (dieRoll === 2) {
      detail = 'both teams receive 1 extra Bribe for this match'
    } else if (dieRoll === 3) {
      if (m.riotTurn === 'none') {
        detail = "receiving team hasn't taken a turn this half — both turn markers move forward 1 space"
      } else if (m.riotTurn === 7) {
        detail = "receiving team is on turn 7 — both turn markers move back 1 space"
      } else if (m.riotD6 !== '') {
        const forward = m.riotD6 <= 3
        detail = `D6 ${m.riotD6} — both turn markers move ${forward ? 'forward' : 'back'} 1 space`
      }
    } else if (dieRoll === 4) {
      detail = `${kickingName} may reorganise their defence`
    } else if (dieRoll === 5) {
      const moved = m.movedPlayerId ? playerById.get(m.movedPlayerId) : null
      detail = moved ? `${playerLabel(moved)} repositioned to the landing square` : 'no player repositioned'
    } else if (dieRoll === 6 || dieRoll === 8) {
      const isCheer = dieRoll === 6
      const homeBonus = isCheer ? matchData.homeCheerleaders : matchData.homeAssistantCoaches
      const awayBonus = isCheer ? matchData.awayCheerleaders : matchData.awayAssistantCoaches
      const homeTotal = (m.homeCompareDie || 0) + homeKickoffFame + homeBonus
      const awayTotal = (m.awayCompareDie || 0) + awayKickoffFame + awayBonus
      const bonusLabel = isCheer ? 'Cheer' : 'Coach'
      const winner = homeTotal > awayTotal ? 'home' : awayTotal > homeTotal ? 'away' : 'tie'
      detail = `Home D3${m.homeCompareDie}+FAME${homeKickoffFame}+${bonusLabel}${homeBonus}=${homeTotal} vs Away D3${m.awayCompareDie}+FAME${awayKickoffFame}+${bonusLabel}${awayBonus}=${awayTotal} → `
        + (winner === 'tie' ? 'both teams gain an extra re-roll this half' : `${teamName(winner)} gains an extra re-roll this half`)
    } else if (dieRoll === 7) {
      detail = 're-rolling the weather…'
    } else if (dieRoll === 9) {
      detail = `${receivingName}'s players may each make one free square of movement`
    } else if (dieRoll === 10) {
      detail = `${kickingName} gets a free bonus turn` + (m.turnoverEndedEarly ? ' (ended early by a turnover)' : '')
    } else if (dieRoll === 11) {
      const homeTotal = (m.rockHomeDie || 0) + homeKickoffFame
      const awayTotal = (m.rockAwayDie || 0) + awayKickoffFame
      const tie = homeTotal === awayTotal
      const thrower = tie ? null : homeTotal > awayTotal ? 'home' : 'away'
      const parts: string[] = [`Home D6${m.rockHomeDie}+FAME${homeKickoffFame}=${homeTotal} vs Away D6${m.rockAwayDie}+FAME${awayKickoffFame}=${awayTotal}`]
      if (tie) {
        parts.push('tie — a rock is thrown at each team')
        if (m.rockVictimId) {
          const v = playerById.get(m.rockVictimId)
          if (v) parts.push(`${teamName('home')}: ${playerLabel(v)} hit [${m.rockResult ?? '?'}]`)
        }
        if (m.rockVictimId2) {
          const v2 = playerById.get(m.rockVictimId2)
          if (v2) parts.push(`${teamName('away')}: ${playerLabel(v2)} hit [${m.rockResult2 ?? '?'}]`)
        }
      } else {
        const hitSide = thrower === 'home' ? 'away' : 'home'
        parts.push(`${teamName(thrower!)}'s fans threw the rock`)
        if (m.rockVictimId) {
          const v = playerById.get(m.rockVictimId)
          if (v) parts.push(`${teamName(hitSide)}: ${playerLabel(v)} hit [${m.rockResult ?? '?'}]`)
        }
      }
      detail = parts.join(' · ')
    } else if (dieRoll === 12) {
      const homeNames = m.stunnedHomeIds.map((id) => playerById.get(id)).filter(Boolean).map((p) => playerLabel(p!))
      const awayNames = m.stunnedAwayIds.map((id) => playerById.get(id)).filter(Boolean).map((p) => playerLabel(p!))
      detail = `Home Stunned: ${homeNames.length ? homeNames.join(', ') : 'none'} · Away Stunned: ${awayNames.length ? awayNames.join(', ') : 'none'}`
    }

    const label = `🏈 Kick-Off${m.eventTurn ? ` (T${m.eventTurn})` : ''} — ${kickingName} kicks, ${receivingName} receives · ${result.name}${detail ? `: ${detail}` : ''}`
    pushKickoffEvent({ id: uid(), type: 'KICKOFF', turn: m.eventTurn ?? undefined, label }, dieRoll)

    // Throw a Rock resolves straight to the Casualty table (no Armour roll) — log it as a real
    // casualty too, so it flows through post-match stats/niggling tracking like any other.
    if (dieRoll === 11) {
      const homeTotal = (m.rockHomeDie || 0) + homeKickoffFame
      const awayTotal = (m.rockAwayDie || 0) + awayKickoffFame
      const tie = homeTotal === awayTotal
      if (m.rockVictimId && m.rockResult) {
        const v = playerById.get(m.rockVictimId)
        pushEvent({ id: uid(), type: 'CASUALTY', turn: m.eventTurn ?? undefined, victimId: m.rockVictimId, casualtyResult: m.rockResult,
          label: `T${m.eventTurn ?? '?'} · 🪨 Throw a Rock → ${v ? playerLabel(v) : '?'} [${m.rockResult}]` })
      }
      if (tie && m.rockVictimId2 && m.rockResult2) {
        const v2 = playerById.get(m.rockVictimId2)
        pushEvent({ id: uid(), type: 'CASUALTY', turn: m.eventTurn ?? undefined, victimId: m.rockVictimId2, casualtyResult: m.rockResult2,
          label: `T${m.eventTurn ?? '?'} · 🪨 Throw a Rock → ${v2 ? playerLabel(v2) : '?'} [${m.rockResult2}]` })
      }
    }

    if (dieRoll === 7 && m.weatherDie1 !== '' && m.weatherDie2 !== '') {
      persistTransition(async () => { await rollWeather(matchData.id, m.weatherDie1 as number, m.weatherDie2 as number) })
    }

    setState((prev) => ({
      ...prev,
      kickingTeam: m.kickingTeam,
      firstKickingTeam: prev.firstKickingTeam ?? m.kickingTeam,
      pendingKickoff: false,
    }))
    setModal(null)
  }

  function availableMedical(side: 'home' | 'away'): MedicalOption[] {
    const list: MedicalOption[] = []
    const hasApoth  = side === 'home' ? matchData.homeHasApothecary  : matchData.awayHasApothecary
    const apothUsed = side === 'home' ? matchData.homeApothecaryUsed : matchData.awayApothecaryUsed
    if (hasApoth && !apothUsed) list.push({ kind: 'apothecary', label: 'Team Apothecary' })
    const purchased = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
    purchased.filter((p) => p.name === 'Wandering Apothecary' && !p.used).forEach((p, i) => list.push({ kind: 'matchInducement', id: p.id, label: `Wandering Apothecary #${i + 1}` }))
    purchased.filter((p) => p.name === 'Igor' && !p.used).forEach((p, i) => list.push({ kind: 'matchInducement', id: p.id, label: `Igor #${i + 1}` }))
    return list
  }

  function commitCasualty() {
    if (modal?.type !== 'casualty') return
    const { attackTeam, attackerId, victimId, result, eventTurn, medical } = modal
    if (!attackTeam || !attackerId || !victimId || !result || !eventTurn) return
    const attacker = playerById.get(attackerId)!
    const victim   = playerById.get(victimId)!
    const atkTeam  = attackTeam === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const medicalNote = medical ? ` — saved by ${medical.label}` : ''
    const label    = `T${eventTurn} · CAS · ${playerLabel(attacker)} (${atkTeam}) → ${playerLabel(victim)} [${result}]${medicalNote}`
    pushEvent({ id: uid(), type: 'CASUALTY', turn: eventTurn, scoringTeam: attackTeam, attackerId, victimId, casualtyResult: result, label })
    if (medical) {
      const victimSide = playerTeam.get(victimId)
      startMercTransition(async () => {
        if (medical.kind === 'apothecary' && victimSide) await markApothecaryUsed(matchData.id, victimSide)
        else if (medical.kind === 'matchInducement' && medical.id) await markInducementUsed(matchData.id, medical.id)
        router.refresh()
      })
    }
    setModal(null)
  }

  function commitInterception() {
    if (modal?.type !== 'interception') return
    const { playerId, eventTurn } = modal
    if (!playerId || !eventTurn) return
    const p    = playerById.get(playerId)!
    const team = playerTeam.get(playerId) === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    pushEvent({ id: uid(), type: 'INTERCEPTION', turn: eventTurn, interceptorId: playerId, label: `T${eventTurn} · INT · ${playerLabel(p)} (${team})` })
    setModal(null)
  }

  function commitWizardEffect(overrideVictims?: { playerId: string; result: CasualtyResult }[]) {
    if (modal?.type !== 'wizard') return
    const { side, spell, eventTurn } = modal
    const victims = overrideVictims ?? modal.victims
    if (!side || !spell || !eventTurn || victims.length === 0) return
    const spellName = spell === 'fireball' ? 'Fireball' : 'Lightning Bolt'
    for (const v of victims) {
      const victim     = playerById.get(v.playerId)!
      const victimTeam = playerTeam.get(v.playerId) === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
      pushEvent({
        id: uid(), type: 'CASUALTY', turn: eventTurn, victimId: v.playerId, casualtyResult: v.result,
        label: `T${eventTurn} · WIZARD · ${spellName} → ${playerLabel(victim)} (${victimTeam}) [${v.result}]`,
      })
    }
    const purchased = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
    const wizardRow = purchased.find((p) => p.name === 'Wizards' && !p.used)
    if (wizardRow) {
      startMercTransition(async () => {
        await markInducementUsed(matchData.id, wizardRow.id)
        router.refresh()
      })
    }
    setModal(null)
  }

  function commitSentOff() {
    if (modal?.type !== 'sentoff') return
    const { team, playerId, eventTurn, bribeId, outcome } = modal
    if (!team || !playerId || !eventTurn) return
    const p        = playerById.get(playerId)!
    const teamName = team === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const bribeNote = bribeId
      ? ` — Bribe ${outcome === 'success' ? 'successful, stays on field' : 'failed, sent off anyway'}`
      : ''
    pushEvent({
      id: uid(), type: 'SENT_OFF', turn: eventTurn,
      label: `T${eventTurn} · SENT OFF · ${playerLabel(p)} (${teamName})${bribeNote}`,
    })
    if (bribeId) {
      startMercTransition(async () => {
        await markInducementUsed(matchData.id, bribeId)
        router.refresh()
      })
    }
    setModal(null)
  }

  function commitChef() {
    if (modal?.type !== 'chef') return
    const { half, side, successes } = modal
    if (!half || !side || successes === null) return
    const teamName     = side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const opponentName = side === 'home' ? matchData.awayTeam.name : matchData.homeTeam.name
    pushEvent({
      id: uid(), type: 'CHEF',
      label: `Half ${half} · 👨‍🍳 Chef — ${teamName} rolled ${successes} success(es): +${successes} re-roll(s) for ${teamName}, -${successes} (or as many as they have) for ${opponentName}`,
    })
    const purchased = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
    const chefRow = purchased.find((p) => p.name === 'Halfling Master Chef')
    if (chefRow) {
      startMercTransition(async () => {
        await markInducementUsed(matchData.id, chefRow.id, half)
        router.refresh()
      })
    }
    setModal(null)
  }

  function commitSpecialPlayCard() {
    if (modal?.type !== 'specialCard') return
    const { side, slotId, cardId, eventTurn } = modal
    if (!side || !slotId || !cardId || !eventTurn) return
    const teamName = side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
    const slots    = side === 'home' ? matchData.homeSpecialPlayCards : matchData.awaySpecialPlayCards
    const slot     = slots.find((s) => s.id === slotId)
    const deck     = matchData.specialPlayDecks.find((d) => d.id === slot?.deckId)
    const card     = deck?.cards.find((c) => c.id === cardId)
    if (!slot || !card) return
    pushEvent({
      id: uid(), type: 'SPECIAL_CARD', turn: eventTurn,
      label: `T${eventTurn} · 🃏 ${teamName} plays ${card.name} (${deck!.name})`,
    })
    startMercTransition(async () => {
      await registerSpecialPlayCard(matchData.id, slotId, cardId, eventTurn)
      router.refresh()
    })
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
  // PHASE 1 — PRE-MATCH WIZARD
  // ─────────────────────────────────────────────────────────────────────────

  if (state.phase === 'prematch') {
    // Inducement gold gap: struck from the frozen roster-only value, not the evolving one —
    // otherwise each purchase raises team value and shrinks the very budget it's paid from.
    const homeBase = matchData.homeBaseTeamValue + homePettyGold / 1000
    const awayBase = matchData.awayBaseTeamValue + awayPettyGold / 1000
    const diff         = Math.abs(homeBase - awayBase)
    const inducementGp = Math.round(diff * 1000)
    const receivingTeam: 'home' | 'away' | null =
      homeBase < awayBase ? 'home' : awayBase < homeBase ? 'away' : null

    function handleConfirmInducements() {
      startWizardTransition(async () => {
        await savePrematchData(matchData.id, {
          homeTeamValue:     matchData.homeTeamValue,
          awayTeamValue:     matchData.awayTeamValue,
          homeTeamFanFactor: matchData.homeTeamFanFactor,
          awayTeamFanFactor: matchData.awayTeamFanFactor,
        })
        setWizardStep('fans')
      })
    }

    function handleConfirmFansAndKickOff() {
      startWizardTransition(async () => {
        if (homeFansDie1 !== '' && homeFansDie2 !== '' && awayFansDie1 !== '' && awayFansDie2 !== '') {
          await saveFansAndFame(matchData.id, homeFansDie1, homeFansDie2, awayFansDie1, awayFansDie2)
        }
        try { await startMatch(matchData.id) } catch {}
        setState((prev) => ({ ...prev, phase: 'live', pendingKickoff: true }))
        setModal(freshKickoffModal({ step: 'toss', isFirstKickoff: true, kickingTeam: null }))
      })
    }

    return (
      <div className="min-h-screen bg-bb-darker text-white flex flex-col">
        {/* Header */}
        <div className="bg-bb-dark border-b border-bb-border px-6 py-4">
          <span className="text-xs text-bb-gold/60 font-heading uppercase tracking-widest">Round {matchData.round}</span>
          <h1 className="font-heading text-2xl font-black text-white mt-0.5">Pre-Match Wizard</h1>
          <div className="flex gap-2 mt-3">
            {(['weather', 'petty-gold', 'lineup', 'inducements', 'fans'] as const).map((s, i, arr) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-heading font-bold border ${
                  wizardStep === s
                    ? 'bg-bb-gold border-bb-gold text-bb-dark'
                    : 'border-bb-border text-bb-muted'
                }`}>{i + 1}</div>
                <span className={`text-xs font-heading uppercase tracking-wider ${wizardStep === s ? 'text-bb-gold' : 'text-bb-muted'}`}>
                  {s === 'weather' ? 'Weather' : s === 'petty-gold' ? 'Petty Gold' : s === 'lineup' ? 'Lineup' : s === 'inducements' ? 'Inducements' : 'Fans & FAME'}
                </span>
                {i < arr.length - 1 && <span className="text-bb-border text-xs">›</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: Weather */}
        {wizardStep === 'weather' && (
          <div className="flex-1 flex flex-col items-center justify-center p-6 gap-6">
            {matchData.weather ? (
              <div className="text-center">
                <div className="text-6xl mb-3">{WEATHER_ICON[matchData.weather.name] ?? '🌦️'}</div>
                <h2 className="font-heading text-2xl font-bold text-bb-gold">{matchData.weather.name}</h2>
                <p className="text-sm text-bb-muted mt-2 max-w-md">{matchData.weather.description}</p>
              </div>
            ) : (
              <>
                <p className="text-sm text-bb-muted text-center max-w-sm">
                  Both coaches roll a D6 and add the results together to see what the weather is like for the match.
                </p>
                <div className="flex items-center gap-3">
                  <select value={weatherDie1} onChange={(e) => setWeatherDie1(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold">
                    <option value="" disabled>D1</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <span className="text-bb-muted">+</span>
                  <select value={weatherDie2} onChange={(e) => setWeatherDie2(e.target.value ? parseInt(e.target.value, 10) : '')}
                    className="bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold">
                    <option value="" disabled>D2</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                  <button
                    disabled={wizardPending || weatherDie1 === '' || weatherDie2 === ''}
                    onClick={() => startWizardTransition(async () => {
                      await rollWeather(matchData.id, weatherDie1 as number, weatherDie2 as number)
                      router.refresh()
                    })}
                    className="px-6 py-2 bg-bb-gold hover:bg-bb-gold-dim text-bb-dark font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                    {wizardPending ? 'Rolling…' : 'Roll'}
                  </button>
                </div>
              </>
            )}
            <div className="flex justify-end w-full pt-6">
              <button
                onClick={() => setWizardStep('petty-gold')}
                disabled={!matchData.weather}
                className="px-8 py-3 bg-bb-gold hover:bg-bb-gold-dim text-bb-dark font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Petty Gold */}
        {wizardStep === 'petty-gold' && (
          <div className="flex-1 flex flex-col p-6">
            <p className="text-sm text-bb-muted mb-6">
              Coaches may spend gold from their treasury as Petty Cash before inducements are calculated.
            </p>
            <div className="grid grid-cols-2 gap-4 flex-1">
              {(['home', 'away'] as const).map((side) => {
                const teamName = side === 'home' ? matchData.homeTeam.name  : matchData.awayTeam.name
                const tv       = side === 'home' ? matchData.homeTeamValue  : matchData.awayTeamValue
                const treasury = side === 'home' ? matchData.homeTeamTreasury : matchData.awayTeamTreasury
                const petty    = side === 'home' ? homePettyGold : awayPettyGold
                const setPetty = side === 'home' ? setHomePettyGold : setAwayPettyGold
                const logo     = side === 'home' ? homeLogo : awayLogo
                // Current treasury already reflects any previously-committed Petty Cash for this
                // side, so the true ceiling for a revised amount is treasury + what's already committed.
                const committed = side === 'home' ? matchData.homePettyCash : matchData.awayPettyCash
                const maxPetty  = treasury + committed
                const overMax   = petty > maxPetty

                return (
                  <div key={side} className={`bg-bb-dark border rounded-sm p-5 flex flex-col gap-4 ${overMax ? 'border-bb-crimson' : 'border-bb-border'}`}>
                    <div className="flex items-center gap-3">
                      {logo && <img src={logo} alt={teamName} className="w-10 h-10 object-contain opacity-80 shrink-0" />}
                      <div>
                        <h2 className="font-heading text-lg font-bold text-bb-gold leading-tight">{teamName}</h2>
                        <p className="text-xs text-bb-muted">{side === 'home' ? 'Home' : 'Away'}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="text-bb-muted font-heading uppercase tracking-wider">Team Value</span>
                        <span className="text-white font-mono">{tv}k</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-bb-muted font-heading uppercase tracking-wider">Fan Factor</span>
                        <span className="text-white font-mono">{side === 'home' ? matchData.homeTeamFanFactor : matchData.awayTeamFanFactor}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-bb-muted font-heading uppercase tracking-wider">Treasury</span>
                        <span className="text-white font-mono">{treasury.toLocaleString()} gp</span>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-heading uppercase tracking-wider text-bb-muted mb-1.5">
                        Petty Gold (gp)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={maxPetty}
                        step={1000}
                        value={petty}
                        onChange={(e) => setPetty(Math.max(0, parseInt(e.target.value) || 0))}
                        className={`w-full bg-bb-darker border rounded-sm px-3 py-2 text-sm text-white focus:outline-none font-mono ${
                          overMax ? 'border-bb-crimson focus:border-bb-crimson' : 'border-bb-border focus:border-bb-gold'
                        }`}
                      />
                      {overMax && (
                        <p className="text-xs text-bb-crimson mt-1">Cannot exceed treasury ({maxPetty.toLocaleString()} gp)</p>
                      )}
                      {!overMax && petty > 0 && (
                        <p className="text-xs text-bb-muted/70 mt-1">Remaining: {(maxPetty - petty).toLocaleString()} gp</p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="flex justify-end pt-6">
              <button
                onClick={() => startWizardTransition(async () => {
                  await commitPettyCash(matchData.id, homePettyGold, awayPettyGold)
                  router.refresh()
                  setWizardStep('lineup')
                })}
                disabled={wizardPending || homePettyGold > matchData.homeTeamTreasury + matchData.homePettyCash || awayPettyGold > matchData.awayTeamTreasury + matchData.awayPettyCash}
                className="px-8 py-3 bg-bb-gold hover:bg-bb-gold-dim text-bb-dark font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {wizardPending ? 'Saving…' : 'Next →'}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Lineup */}
        {wizardStep === 'lineup' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-6 pt-5 shrink-0">
              <p className="text-sm text-bb-muted">
                Every available player automatically plays — MNG players cannot be fielded and don&apos;t count as active.
              </p>
            </div>

            <div className="flex-1 grid grid-cols-2 divide-x divide-bb-border overflow-auto">
              {(['home', 'away'] as const).map((side) => {
                const team         = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                const logo         = side === 'home' ? homeLogo : awayLogo
                const activeCount  = (side === 'home' ? homePlaying : awayPlaying).length
                const journeyTypes = side === 'home' ? matchData.homeJourneymanTypes : matchData.awayJourneymanTypes
                const countColor   = activeCount > 16 ? 'text-bb-crimson' : activeCount < 11 ? 'text-amber-400' : 'text-white'
                return (
                  <div key={side} className="p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
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
                      <span className={`text-sm font-mono font-bold ${countColor}`}>{activeCount} / 16 active</span>
                    </div>

                    {activeCount > 16 && (
                      <p className="text-xs text-bb-crimson bg-bb-crimson/10 border border-bb-crimson/40 rounded-sm px-3 py-2">
                        Too many active players — a team can field at most 16. Ask your commissioner to adjust player statuses in Data Manager before continuing.
                      </p>
                    )}

                    <datalist id={`mng-numbers-${side}`}>
                      {team.players.filter((p) => p.status === 'MNG').map((p) => (
                        <option key={p.id} value={p.number}>{p.name ?? p.playerTypeName} (MNG)</option>
                      ))}
                    </datalist>

                    <div className="space-y-1">
                      {team.players.length === 0 && (
                        <p className="text-bb-muted text-sm italic">No players available.</p>
                      )}
                      {team.players.map((p) => (
                        <div key={p.id}
                          className={`flex items-center gap-3 p-2 rounded-sm ${p.status === 'MNG' ? 'opacity-40' : ''}`}>
                          {p.isMerc
                            ? <span className="text-[10px] bg-purple-900/40 text-purple-300 border border-purple-700/40 px-1.5 py-0.5 rounded-sm font-heading shrink-0">MERC</span>
                            : p.isJourneyman
                              ? (
                                <>
                                  <span className="text-[10px] bg-teal-900/40 text-teal-300 border border-teal-700/40 px-1.5 py-0.5 rounded-sm font-heading shrink-0">JM</span>
                                  <input
                                    type="number" min={1} max={99} list={`mng-numbers-${side}`}
                                    defaultValue={p.number || ''}
                                    placeholder="#"
                                    onBlur={(e) => {
                                      const n = e.target.value ? parseInt(e.target.value, 10) : null
                                      startMercTransition(async () => {
                                        await updateJourneymanNumber(matchData.id, p.id, n)
                                        router.refresh()
                                      })
                                    }}
                                    className="w-12 bg-bb-darker border border-bb-border rounded-sm px-1.5 py-0.5 text-xs text-white font-mono focus:outline-none focus:border-bb-gold shrink-0"
                                  />
                                </>
                              )
                              : <span className="text-sm text-bb-muted w-6 font-heading shrink-0">#{p.number}</span>
                          }
                          <span className="text-sm text-white flex-1">{p.name ?? p.playerTypeName}</span>
                          <span className="text-xs text-bb-muted/60 italic">{p.playerTypeName}</span>
                          {p.status === 'MNG' && (
                            <span className="text-[10px] bg-amber-900/40 text-amber-400 border border-amber-700/40 px-1.5 py-0.5 rounded-sm font-heading">MNG</span>
                          )}
                          {p.isJourneyman && (
                            <button
                              disabled={mercPending}
                              onClick={() => startMercTransition(async () => {
                                await removeJourneyman(matchData.id, p.id)
                                router.refresh()
                              })}
                              className="shrink-0 w-6 h-6 flex items-center justify-center text-bb-muted hover:text-bb-crimson transition-colors rounded-sm text-sm"
                            >✕</button>
                          )}
                        </div>
                      ))}
                    </div>

                    {activeCount < 11 && (
                      <div className="bg-bb-dark border border-bb-gold/30 rounded-sm p-3 mt-auto">
                        <p className="text-xs font-heading uppercase tracking-wider text-bb-gold mb-2">
                          Below 11 — hire a free Journeyman
                        </p>
                        <div className="space-y-2">
                          {journeyTypes.map((pt) => (
                            <div key={pt.id} className="flex items-center justify-between gap-2 text-xs">
                              <span className="text-white">{pt.name}</span>
                              <span className="font-mono text-bb-muted">{pt.cost.toLocaleString()} gp</span>
                              <button
                                disabled={mercPending}
                                onClick={() => startMercTransition(async () => {
                                  await hireJourneyman(matchData.id, side, pt.id)
                                  router.refresh()
                                })}
                                className="px-2.5 py-1 text-[11px] font-heading uppercase tracking-wider rounded-sm border border-bb-gold/60 text-bb-gold hover:bg-bb-gold hover:text-bb-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                              >+ Hire Free</button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            <div className="flex justify-between px-6 py-4 shrink-0">
              <button
                onClick={() => setWizardStep('petty-gold')}
                className="px-6 py-3 border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted rounded-sm font-heading tracking-widest uppercase text-sm transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setWizardStep('inducements')}
                disabled={homePlaying.length > 16 || awayPlaying.length > 16}
                className="px-8 py-3 bg-bb-gold hover:bg-bb-gold-dim text-bb-dark font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}

        {/* Step 4: Inducements + Basket */}
        {wizardStep === 'inducements' && (() => {
          const homeBudget   = (receivingTeam === 'home' ? inducementGp : 0) + homePettyGold
          const awayBudget   = (receivingTeam === 'away' ? inducementGp : 0) + awayPettyGold
          const homeShopping = homeBudget > 0
          const awayShopping = awayBudget > 0
          const homeSpent     = matchData.homeTeam.players.filter((p) => p.isMerc).reduce((s, p) => s + (p.mercCost ?? 0), 0)
                              + matchData.homeInducementsPurchased.reduce((s, p) => s + p.cost, 0)
                              + matchData.homeSpecialPlayCards.reduce((s, p) => s + p.cost, 0)
          const awaySpent     = matchData.awayTeam.players.filter((p) => p.isMerc).reduce((s, p) => s + (p.mercCost ?? 0), 0)
                              + matchData.awayInducementsPurchased.reduce((s, p) => s + p.cost, 0)
                              + matchData.awaySpecialPlayCards.reduce((s, p) => s + p.cost, 0)
          const homeRemaining = homeBudget - homeSpent
          const awayRemaining = awayBudget - awaySpent

          function InducementPanel({ side }: { side: 'home' | 'away' }) {
            const budget      = side === 'home' ? homeBudget : awayBudget
            const teamName    = side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
            const tv          = side === 'home' ? matchData.homeTeamValue : matchData.awayTeamValue
            const playerTypes = side === 'home' ? matchData.homePlayerTypes : matchData.awayPlayerTypes
            const starPlayers = side === 'home' ? matchData.homeStarPlayers : matchData.awayStarPlayers
            const players     = side === 'home' ? matchData.homeTeam.players : matchData.awayTeam.players
            const items       = side === 'home' ? matchData.homeInducementTypes : matchData.awayInducementTypes
            const purchased   = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
            const tab         = side === 'home' ? induceTabHome : induceTabAway
            const setTab      = side === 'home' ? setInduceTabHome : setInduceTabAway
            const hiredMercs  = players.filter((p) => p.isMerc && !p.isStarPlayer)
            const hiredStars  = players.filter((p) => p.isStarPlayer)
            const hiredStarIds = new Set(hiredStars.map((p) => p.starPlayerId).filter(Boolean))
            const specialCards = side === 'home' ? matchData.homeSpecialPlayCards : matchData.awaySpecialPlayCards
            const spent       = [...hiredMercs, ...hiredStars].reduce((s, p) => s + (p.mercCost ?? 0), 0)
                              + purchased.reduce((s, p) => s + p.cost, 0)
                              + specialCards.reduce((s, p) => s + p.cost, 0)
            const remaining   = budget - spent

            return (
              <div className="flex flex-col gap-2">
                {/* Budget banner */}
                <div className="bg-bb-dark border border-bb-border rounded-sm px-4 py-2.5 flex items-center justify-between shrink-0">
                  <div>
                    <span className="text-xs text-bb-muted font-heading uppercase tracking-wider">Inducement Budget — </span>
                    <span className="text-xs text-white font-heading">{teamName}</span>
                  </div>
                  <div className="flex gap-4 text-xs font-mono">
                    <span className="text-bb-muted">Budget: <span className="text-white">{budget.toLocaleString()}</span></span>
                    <span className="text-bb-muted">Spent: <span className="text-bb-crimson">{spent.toLocaleString()}</span></span>
                    <span className="text-bb-muted">Left: <span className={remaining < 0 ? 'text-bb-crimson' : 'text-bb-gold'}>{remaining.toLocaleString()}</span></span>
                  </div>
                </div>

                {/* Pricelist + Basket */}
                <div className="grid grid-cols-[55%_45%] gap-3 overflow-hidden min-h-[320px]">
                    {/* Pricelist with Stars / Mercs tabs */}
                    <div className="bg-bb-dark border border-bb-border rounded-sm flex flex-col overflow-hidden">
                      {/* Tabs */}
                      <div className="flex border-b border-bb-border shrink-0">
                        {(['stars', 'mercs', 'items', 'cards'] as const).map((t) => (
                          <button
                            key={t}
                            onClick={() => setTab(t)}
                            className={`flex-1 py-2 text-[11px] font-heading uppercase tracking-wider transition-colors ${
                              tab === t
                                ? 'text-bb-gold border-b-2 border-bb-gold -mb-px bg-bb-gold/5'
                                : 'text-bb-muted hover:text-white'
                            }`}
                          >
                            {t === 'stars' ? `⭐ Stars (${starPlayers.length})` : t === 'mercs' ? `⚔ Mercs (${playerTypes.length})` : t === 'items' ? `🎁 Items (${items.length})` : `🃏 Cards (${matchData.specialPlayDecks.length})`}
                          </button>
                        ))}
                      </div>

                      <div className="overflow-y-auto flex-1 divide-y divide-bb-border/30">
                        {/* ── Star Players tab ── */}
                        {tab === 'stars' && starPlayers.map((sp) => {
                          const alreadyHired = hiredStarIds.has(sp.id)
                          const affordable   = sp.price <= remaining
                          return (
                            <div key={sp.id} className={`px-4 py-3 ${!affordable && !alreadyHired ? 'opacity-40' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-heading leading-tight">{sp.name}</p>
                                  {sp.companions.length > 0 && (
                                    <p className="text-[10px] text-bb-gold/70 mt-0.5">+ {sp.companions.map((c) => c.name).join(', ')} (free)</p>
                                  )}
                                  <p className="font-mono text-[11px] text-bb-muted mt-0.5">
                                    MA{sp.ma} ST{sp.st} AG{sp.ag} AV{sp.av}
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {sp.skills.map((sk) => {
                                      const key    = `${sp.id}||${sk.name}`
                                      const isOpen = openSkillKey === key
                                      return (
                                        <button key={sk.name} onClick={() => setOpenSkillKey(isOpen ? null : key)} className={`text-[10px] px-1.5 py-1 rounded-sm border font-heading transition-colors touch-manipulation min-h-[28px] ${
                                          isOpen
                                            ? 'border-bb-gold text-bb-gold bg-bb-gold/15'
                                            : sk.name === 'Loner'
                                              ? 'bg-bb-crimson/20 border-bb-crimson/50 text-bb-crimson'
                                              : 'bg-bb-gold/10 border-bb-gold/30 text-bb-gold'
                                        }`}>{sk.name}</button>
                                      )
                                    })}
                                  </div>
                                  {openSkillKey && openSkillKey.startsWith(`${sp.id}||`) && (() => {
                                    const skill = sp.skills.find((s) => `${sp.id}||${s.name}` === openSkillKey)
                                    return skill ? (
                                      <div className="mt-1.5 text-[11px] text-bb-muted/90 leading-relaxed bg-bb-darker border border-bb-border/40 rounded-sm px-3 py-2">
                                        <span className="text-bb-gold font-heading text-[10px] uppercase tracking-wider block mb-0.5">{skill.name}</span>
                                        {skill.rule}
                                      </div>
                                    ) : null
                                  })()}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="font-mono text-xs text-white">{sp.price.toLocaleString()}</p>
                                  <p className="font-mono text-[10px] text-bb-muted">gp</p>
                                  <button
                                    disabled={(!affordable || mercPending) && !alreadyHired}
                                    onClick={() => {
                                      if (alreadyHired) return
                                      startMercTransition(async () => {
                                        await hireStarPlayer(matchData.id, side, sp.id, sp.price)
                                        router.refresh()
                                      })
                                    }}
                                    className={`mt-1.5 px-2.5 py-1 text-[11px] font-heading uppercase tracking-wider rounded-sm border transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                                      alreadyHired
                                        ? 'border-bb-gold bg-bb-gold/20 text-bb-gold cursor-default'
                                        : 'border-bb-gold/60 text-bb-gold hover:bg-bb-gold hover:text-bb-dark'
                                    }`}
                                  >{alreadyHired ? '✓' : '+'}</button>
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {/* ── Mercs tab ── */}
                        {tab === 'mercs' && playerTypes.map((pt) => {
                          const affordable = pt.mercCost <= remaining
                          return (
                            <div key={pt.id} className={`px-4 py-3 ${!affordable ? 'opacity-40' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-heading leading-tight">{pt.name}</p>
                                  <p className="font-mono text-[11px] text-bb-muted mt-0.5">
                                    MA{pt.ma} ST{pt.st} AG{pt.ag} AV{pt.av}
                                  </p>
                                  <div className="flex flex-wrap gap-1 mt-1.5">
                                    {pt.skills.map((sk) => {
                                      const key    = `${pt.id}||${sk.name}`
                                      const isOpen = openSkillKey === key
                                      return (
                                        <button key={sk.name} onClick={() => setOpenSkillKey(isOpen ? null : key)} className={`text-[10px] px-1.5 py-1 rounded-sm border font-heading transition-colors touch-manipulation min-h-[28px] ${
                                          isOpen
                                            ? 'border-bb-gold text-bb-gold bg-bb-gold/15'
                                            : sk.name === 'Loner'
                                              ? 'bg-bb-crimson/20 border-bb-crimson/50 text-bb-crimson'
                                              : 'bg-bb-border/30 border-bb-border text-bb-muted'
                                        }`}>{sk.name}</button>
                                      )
                                    })}
                                  </div>
                                  {openSkillKey && openSkillKey.startsWith(`${pt.id}||`) && (() => {
                                    const skill = pt.skills.find((s) => `${pt.id}||${s.name}` === openSkillKey)
                                    return skill ? (
                                      <div className="mt-1.5 text-[11px] text-bb-muted/90 leading-relaxed bg-bb-darker border border-bb-border/40 rounded-sm px-3 py-2">
                                        <span className="text-bb-gold font-heading text-[10px] uppercase tracking-wider block mb-0.5">{skill.name}</span>
                                        {skill.rule}
                                      </div>
                                    ) : null
                                  })()}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="font-mono text-xs text-white">{pt.mercCost.toLocaleString()}</p>
                                  <p className="font-mono text-[10px] text-bb-muted">gp</p>
                                  <button
                                    disabled={!affordable || mercPending}
                                    onClick={() => startMercTransition(async () => {
                                      await hireMerc(matchData.id, side, pt.id, pt.mercCost)
                                      router.refresh()
                                    })}
                                    className="mt-1.5 px-2.5 py-1 text-[11px] font-heading uppercase tracking-wider rounded-sm border border-bb-gold/60 text-bb-gold hover:bg-bb-gold hover:text-bb-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >+</button>
                                </div>
                              </div>
                            </div>
                          )
                        })}

                        {/* ── Items tab ── */}
                        {tab === 'items' && items.map((ind) => {
                          const boughtCount = purchased.filter((p) => p.inducementId === ind.id).length
                          const atMax       = boughtCount >= ind.maxCount
                          const affordable  = ind.price <= remaining
                          const key         = `${ind.id}||rule`
                          const isOpen      = openSkillKey === key
                          return (
                            <div key={ind.id} className={`px-4 py-3 ${(!affordable || atMax) ? 'opacity-40' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-heading leading-tight">{ind.name}</p>
                                  <p className="font-mono text-[11px] text-bb-muted mt-0.5">{boughtCount} / {ind.maxCount} purchased</p>
                                  <button onClick={() => setOpenSkillKey(isOpen ? null : key)} className={`mt-1.5 text-[10px] px-1.5 py-1 rounded-sm border font-heading transition-colors touch-manipulation min-h-[28px] ${
                                    isOpen
                                      ? 'border-bb-gold text-bb-gold bg-bb-gold/15'
                                      : 'bg-bb-gold/10 border-bb-gold/30 text-bb-gold'
                                  }`}>{isOpen ? 'Hide Rule' : 'View Rule'}</button>
                                  {isOpen && (
                                    <div className="mt-1.5 text-[11px] text-bb-muted/90 leading-relaxed bg-bb-darker border border-bb-border/40 rounded-sm px-3 py-2 whitespace-pre-line">
                                      {ind.rule}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="font-mono text-xs text-white">{ind.price.toLocaleString()}</p>
                                  <p className="font-mono text-[10px] text-bb-muted">gp</p>
                                  <button
                                    disabled={!affordable || atMax || mercPending}
                                    onClick={() => startMercTransition(async () => {
                                      await hireInducement(matchData.id, side, ind.id, ind.price)
                                      router.refresh()
                                    })}
                                    className="mt-1.5 px-2.5 py-1 text-[11px] font-heading uppercase tracking-wider rounded-sm border border-bb-gold/60 text-bb-gold hover:bg-bb-gold hover:text-bb-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >+</button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                        {tab === 'cards' && matchData.specialPlayDecks.map((deck) => {
                          const affordable = deck.price <= remaining
                          const key        = `deck-${deck.id}||rule`
                          const isOpen     = openSkillKey === key
                          return (
                            <div key={deck.id} className={`px-4 py-3 ${!affordable ? 'opacity-40' : ''}`}>
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-white font-heading leading-tight">{deck.name}</p>
                                  <p className="font-mono text-[11px] text-bb-muted mt-0.5">{deck.cards.length} cards — random draw</p>
                                  <button onClick={() => setOpenSkillKey(isOpen ? null : key)} className={`mt-1.5 text-[10px] px-1.5 py-1 rounded-sm border font-heading transition-colors touch-manipulation min-h-[28px] ${
                                    isOpen
                                      ? 'border-bb-gold text-bb-gold bg-bb-gold/15'
                                      : 'bg-bb-gold/10 border-bb-gold/30 text-bb-gold'
                                  }`}>{isOpen ? 'Hide Cards' : 'View Cards'}</button>
                                  {isOpen && (
                                    <div className="mt-1.5 text-[11px] text-bb-muted/90 leading-relaxed bg-bb-darker border border-bb-border/40 rounded-sm px-3 py-2 max-h-48 overflow-y-auto space-y-1">
                                      {deck.cards.map((c) => (
                                        <p key={c.id}><span className="text-bb-gold">{c.cardLabel}</span> — {c.name}</p>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="font-mono text-xs text-white">{deck.price.toLocaleString()}</p>
                                  <p className="font-mono text-[10px] text-bb-muted">gp</p>
                                  <button
                                    disabled={!affordable || mercPending}
                                    onClick={() => startMercTransition(async () => {
                                      await buySpecialPlayCard(matchData.id, side, deck.id)
                                      router.refresh()
                                    })}
                                    className="mt-1.5 px-2.5 py-1 text-[11px] font-heading uppercase tracking-wider rounded-sm border border-bb-gold/60 text-bb-gold hover:bg-bb-gold hover:text-bb-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                  >Draw</button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Basket */}
                    <div className="bg-bb-dark border border-bb-border rounded-sm flex flex-col overflow-hidden">
                      <div className="px-4 py-2 border-b border-bb-border shrink-0">
                        <span className="text-xs font-heading uppercase tracking-wider text-bb-gold">Basket</span>
                      </div>
                      <div className="flex-1 overflow-y-auto divide-y divide-bb-border/30">
                        {hiredMercs.length === 0 && hiredStars.length === 0 && purchased.length === 0 && specialCards.length === 0 && (
                          <p className="text-bb-muted text-xs italic px-4 py-4">No inducements hired yet.</p>
                        )}
                        {/* Generic items */}
                        {purchased.map((m) => (
                          <div key={m.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <p className="text-sm text-white truncate">{m.name}</p>
                                <span className="text-[9px] bg-teal-900/40 text-teal-300 border border-teal-700/40 px-1 py-0.5 rounded-sm font-heading shrink-0">ITEM</span>
                              </div>
                              <p className="font-mono text-[11px] text-bb-muted">{m.cost.toLocaleString()} gp</p>
                            </div>
                            <button
                              disabled={mercPending}
                              onClick={() => startMercTransition(async () => {
                                await removeInducement(matchData.id, m.id)
                                router.refresh()
                              })}
                              className="shrink-0 w-6 h-6 flex items-center justify-center text-bb-muted hover:text-bb-crimson transition-colors rounded-sm text-sm"
                            >✕</button>
                          </div>
                        ))}
                        {/* Star players */}
                        {hiredStars.map((m) => {
                          const isCompanion = (m.mercCost ?? 0) === 0
                          return (
                            <div key={m.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 mb-0.5">
                                  <p className="text-sm text-white truncate">{m.name}</p>
                                  <span className="text-[9px] bg-bb-gold/20 text-bb-gold border border-bb-gold/30 px-1 py-0.5 rounded-sm font-heading shrink-0">STAR</span>
                                </div>
                                <p className="font-mono text-[11px] text-bb-muted">
                                  {isCompanion ? 'Free (companion)' : `${(m.mercCost ?? 0).toLocaleString()} gp`}
                                </p>
                              </div>
                              {!isCompanion && (
                                <button
                                  disabled={mercPending}
                                  onClick={() => startMercTransition(async () => {
                                    await removeStarPlayer(matchData.id, m.id)
                                    router.refresh()
                                  })}
                                  className="shrink-0 w-6 h-6 flex items-center justify-center text-bb-muted hover:text-bb-crimson transition-colors rounded-sm text-sm"
                                >✕</button>
                              )}
                            </div>
                          )
                        })}
                        {/* Mercs */}
                        {hiredMercs.map((m) => (
                          <div key={m.id} className="flex items-center justify-between px-4 py-2.5 gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 mb-0.5">
                                <p className="text-sm text-white truncate">{m.playerTypeName}</p>
                                <span className="text-[9px] bg-bb-border/40 text-bb-muted border border-bb-border/60 px-1 py-0.5 rounded-sm font-heading shrink-0">MERC</span>
                              </div>
                              <p className="font-mono text-[11px] text-bb-muted">{(m.mercCost ?? 0).toLocaleString()} gp</p>
                            </div>
                            <button
                              disabled={mercPending}
                              onClick={() => startMercTransition(async () => {
                                await removeMerc(matchData.id, m.id)
                                router.refresh()
                              })}
                              className="shrink-0 w-6 h-6 flex items-center justify-center text-bb-muted hover:text-bb-crimson transition-colors rounded-sm text-sm"
                            >✕</button>
                          </div>
                        ))}
                      </div>
                      {/* Basket totals */}
                      <div className="border-t border-bb-border px-4 py-3 space-y-1 shrink-0">
                        <div className="flex justify-between text-xs">
                          <span className="text-bb-muted font-heading uppercase tracking-wider">Total spent</span>
                          <span className="font-mono text-white">{spent.toLocaleString()} gp</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-bb-muted font-heading uppercase tracking-wider">Remaining</span>
                          <span className={`font-mono font-bold ${remaining < 0 ? 'text-bb-crimson' : 'text-bb-gold'}`}>{remaining.toLocaleString()} gp</span>
                        </div>
                        <div className="flex justify-between text-xs pt-1 border-t border-bb-border/40">
                          <span className="text-bb-muted font-heading uppercase tracking-wider">Team Value</span>
                          <span className="font-mono text-bb-gold">{tv}k</span>
                        </div>
                      </div>
                    </div>
                  </div>
              </div>
            )
          }

          return (
            <div className="flex-1 flex flex-col p-4 gap-4 overflow-hidden">
              {/* TV summary bar */}
              <div className="grid grid-cols-2 gap-3 shrink-0">
                {(['home', 'away'] as const).map((side) => {
                  const tv       = side === 'home' ? matchData.homeTeamValue : matchData.awayTeamValue
                  const petty    = side === 'home' ? homePettyGold : awayPettyGold
                  const base     = side === 'home' ? homeBase : awayBase
                  const isRcvr   = receivingTeam === side
                  const isShopper = side === 'home' ? homeShopping : awayShopping
                  return (
                    <div key={side} className={`rounded-sm p-3 border text-sm ${isRcvr ? 'border-bb-crimson/50 bg-bb-crimson/5' : 'border-bb-border/40 bg-bb-darker'}`}>
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-heading text-xs font-bold text-bb-gold">{side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name}</span>
                        <span className="flex gap-1">
                          {isRcvr && <span className="text-[10px] font-heading text-bb-crimson border border-bb-crimson/40 px-1.5 py-0.5 rounded-sm">RECEIVES</span>}
                          {!isRcvr && isShopper && <span className="text-[10px] font-heading text-bb-gold border border-bb-gold/40 px-1.5 py-0.5 rounded-sm">+ PETTY CASH SHOPPING</span>}
                        </span>
                      </div>
                      <span className="font-mono text-bb-muted text-xs">
                        {tv}k{petty > 0 ? ` + ${(petty/1000).toFixed(1)}k` : ''} = <span className="text-bb-gold font-bold">{base.toFixed(1)}k</span>
                      </span>
                    </div>
                  )
                })}
              </div>

              {!homeShopping && !awayShopping ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <p className="font-heading text-xl text-bb-gold">⚖ No Inducement Budget</p>
                    <p className="text-xs text-bb-muted mt-2">Neither team has inducement gold or Petty Cash to spend.</p>
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col gap-4 overflow-auto">
                  {homeShopping && <InducementPanel side="home" />}
                  {awayShopping && <InducementPanel side="away" />}
                </div>
              )}

              {(homePlaying.length > 16 || awayPlaying.length > 16) && (
                <p className="text-xs text-bb-crimson shrink-0">
                  A team has more than 16 active players — go back to Lineup and resolve this before continuing.
                </p>
              )}

              <div className="flex justify-between shrink-0">
                <button
                  onClick={() => setWizardStep('lineup')}
                  className="px-6 py-3 border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted rounded-sm font-heading tracking-widest uppercase text-sm transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleConfirmInducements}
                  disabled={wizardPending || (homeShopping && homeRemaining < 0) || (awayShopping && awayRemaining < 0) || homePlaying.length > 16 || awayPlaying.length > 16}
                  className="px-8 py-3 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-50"
                >
                  {wizardPending ? 'Saving…' : 'Next →'}
                </button>
              </div>
            </div>
          )
        })()}

        {/* Step 5: Fans & FAME */}
        {wizardStep === 'fans' && (() => {
          const fansReady = homeFansDie1 !== '' && homeFansDie2 !== '' && awayFansDie1 !== '' && awayFansDie2 !== ''
          const alreadyRolled = matchData.homeFame !== null && matchData.awayFame !== null
          return (
            <div className="flex-1 flex flex-col p-6 gap-6">
              <p className="text-sm text-bb-muted">
                Both coaches roll 2D6 and add their team&apos;s Fan Factor to see how many fans turned up — this determines each team&apos;s FAME (Fan Advantage Modifier), used for the Kick-Off table and post-match winnings.
              </p>
              {alreadyRolled ? (
                <div className="grid grid-cols-2 gap-4">
                  {(['home', 'away'] as const).map((side) => {
                    const teamName = side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
                    const fans = side === 'home' ? matchData.homeFans : matchData.awayFans
                    const fame = side === 'home' ? matchData.homeFame : matchData.awayFame
                    return (
                      <div key={side} className="bg-bb-dark border border-bb-border rounded-sm p-4 text-center">
                        <h3 className="font-heading text-sm font-bold text-bb-gold">{teamName}</h3>
                        <p className="text-xs text-bb-muted mt-1">{(fans ?? 0).toLocaleString()} fans</p>
                        <p className="text-lg font-heading font-black text-white mt-1">FAME +{fame}</p>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {(['home', 'away'] as const).map((side) => {
                    const teamName = side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
                    const die1 = side === 'home' ? homeFansDie1 : awayFansDie1
                    const die2 = side === 'home' ? homeFansDie2 : awayFansDie2
                    const setDie1 = side === 'home' ? setHomeFansDie1 : setAwayFansDie1
                    const setDie2 = side === 'home' ? setHomeFansDie2 : setAwayFansDie2
                    return (
                      <div key={side} className="bg-bb-dark border border-bb-border rounded-sm p-4">
                        <h3 className="font-heading text-sm font-bold text-bb-gold mb-2">{teamName}</h3>
                        <div className="flex items-center gap-2">
                          <select value={die1} onChange={(e) => setDie1(e.target.value ? parseInt(e.target.value, 10) : '')}
                            className="bg-bb-darker border border-bb-border rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-bb-gold">
                            <option value="" disabled>D1</option>
                            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                          <span className="text-bb-muted">+</span>
                          <select value={die2} onChange={(e) => setDie2(e.target.value ? parseInt(e.target.value, 10) : '')}
                            className="bg-bb-darker border border-bb-border rounded-sm px-2 py-1.5 text-sm text-white focus:outline-none focus:border-bb-gold">
                            <option value="" disabled>D2</option>
                            {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
              <div className="flex justify-between pt-6">
                <button
                  onClick={() => setWizardStep('inducements')}
                  className="px-6 py-3 border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted rounded-sm font-heading tracking-widest uppercase text-sm transition-colors"
                >
                  ← Back
                </button>
                <button
                  onClick={handleConfirmFansAndKickOff}
                  disabled={wizardPending || (!alreadyRolled && !fansReady) || homePlaying.length > 16 || awayPlaying.length > 16}
                  className="px-8 py-3 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-50"
                >
                  {wizardPending ? 'Saving…' : '⚔ Confirm & Kick Off!'}
                </button>
              </div>
            </div>
          )
        })()}

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

    const wizardAvailable = [...matchData.homeInducementsPurchased, ...matchData.awayInducementsPurchased]
      .some((p) => p.name === 'Wizards' && !p.used)
    const chefAvailable = [...matchData.homeInducementsPurchased, ...matchData.awayInducementsPurchased]
      .some((p) => p.name === 'Halfling Master Chef' && (!p.chefHalf1Used || !p.chefHalf2Used))
    const cardAvailable = [...matchData.homeSpecialPlayCards, ...matchData.awaySpecialPlayCards]
      .some((c) => !c.cardId)

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

          <div className="flex-1 flex flex-col items-center gap-0.5">
            {/* Team names */}
            <div className="grid grid-cols-[1fr_auto_1fr] w-full">
              <div className="text-xs text-bb-muted font-heading uppercase tracking-widest text-right pr-2">{matchData.homeTeam.name}</div>
              <div className="w-16" />
              <div className="text-xs text-bb-muted font-heading uppercase tracking-widest text-left pl-2">{matchData.awayTeam.name}</div>
            </div>

            {/* TD row */}
            <div className="grid grid-cols-[1fr_auto_1fr] w-full items-center">
              <div className="font-heading text-4xl font-black text-bb-gold text-right pr-3">{score.home}</div>
              <div className="text-xl w-16 text-center">🏈</div>
              <div className="font-heading text-4xl font-black text-bb-gold text-left pl-3">{score.away}</div>
            </div>

            {/* CAS row */}
            <div className="grid grid-cols-[1fr_auto_1fr] w-full items-center">
              <div className="font-heading text-lg font-bold text-white text-right pr-3">{cas.home}</div>
              <div className="text-[11px] text-bb-muted font-heading tracking-wide w-16 text-center">💀 CAS</div>
              <div className="font-heading text-lg font-bold text-white text-left pl-3">{cas.away}</div>
            </div>

            {/* Kills row */}
            <div className="grid grid-cols-[1fr_auto_1fr] w-full items-center">
              <div className="font-heading text-lg font-bold text-white text-right pr-3">{kills.home}</div>
              <div className="text-[11px] text-bb-muted font-heading tracking-wide w-16 text-center">☠ Kills</div>
              <div className="font-heading text-lg font-bold text-white text-left pl-3">{kills.away}</div>
            </div>

            {/* FAME row — Kick-Off table FAME (base Fans roll + Fan Favourite); Winnings use base FAME only */}
            <div className="grid grid-cols-[1fr_auto_1fr] w-full items-center">
              <button type="button" onClick={() => setOpenSkillKey(openSkillKey === 'fame-home' ? null : 'fame-home')}
                className="text-right pr-3 touch-manipulation">
                <span className="font-heading text-lg font-bold text-white">{homeKickoffFame}</span>
                {homeFanFavourites > 0 && <span className="text-[10px] text-bb-gold ml-1">(+{homeFanFavourites} FF)</span>}
              </button>
              <div className="text-[11px] text-bb-muted font-heading tracking-wide w-16 text-center">FAME</div>
              <button type="button" onClick={() => setOpenSkillKey(openSkillKey === 'fame-away' ? null : 'fame-away')}
                className="text-left pl-3 touch-manipulation">
                <span className="font-heading text-lg font-bold text-white">{awayKickoffFame}</span>
                {awayFanFavourites > 0 && <span className="text-[10px] text-bb-gold ml-1">(+{awayFanFavourites} FF)</span>}
              </button>
            </div>
            {openSkillKey === 'fame-home' && (
              <p className="text-[10px] text-bb-muted text-center px-4 leading-snug">
                {homeFanFavourites > 0
                  ? `${matchData.homeFame ?? 0} from the Fans roll + ${homeFanFavourites} from Fan Favourite — Kick-Off table only, not Winnings`
                  : 'From the Fans roll'}
              </p>
            )}
            {openSkillKey === 'fame-away' && (
              <p className="text-[10px] text-bb-muted text-center px-4 leading-snug">
                {awayFanFavourites > 0
                  ? `${matchData.awayFame ?? 0} from the Fans roll + ${awayFanFavourites} from Fan Favourite — Kick-Off table only, not Winnings`
                  : 'From the Fans roll'}
              </p>
            )}

            {/* Half indicator */}
            <div className="mt-1">
              <span className="text-[10px] text-bb-muted/60 font-heading uppercase tracking-widest">
                {hasHalftime ? '2nd Half' : '1st Half'}
              </span>
            </div>

            {/* Weather badge — easy-to-see reminder of the match's current conditions */}
            {matchData.weather && (
              <>
                <button type="button" onClick={() => setOpenSkillKey(openSkillKey === 'weather' ? null : 'weather')}
                  className="mt-1 flex items-center gap-1 px-2 py-0.5 rounded-sm border border-bb-border/60 bg-bb-darker touch-manipulation">
                  <span className="text-sm">{WEATHER_ICON[matchData.weather.name] ?? '🌦️'}</span>
                  <span className="text-[10px] text-bb-muted font-heading uppercase tracking-wider">{matchData.weather.name}</span>
                </button>
                {openSkillKey === 'weather' && (
                  <p className="text-[10px] text-bb-muted text-center px-4 leading-snug mt-1 max-w-xs">
                    {matchData.weather.description}
                  </p>
                )}
              </>
            )}
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

            <button onClick={() => setModal({ type: 'td', step: 0, eventTurn: null, team: null, scorerId: null, hasPass: false, passerId: null })}
              className={btnCrimson}>
              <span className="text-base">🏈</span> Touchdown
            </button>

            <button onClick={() => setModal({ type: 'casualty', step: 0, eventTurn: null, attackTeam: null, attackerId: null, victimId: null, result: null, medical: null })}
              className={btnCrimson}>
              <span className="text-base">💀</span> Casualty
            </button>

            <button onClick={() => setModal({ type: 'interception', step: 0, eventTurn: null, team: null, playerId: null })}
              className={btnGhost + ' text-left'}>
              <span className="text-base">🖐</span> Interception
            </button>

            {wizardAvailable && (
              <button onClick={() => setModal({ type: 'wizard', step: 0, eventTurn: null, side: null, spell: null, victims: [], pendingPlayerId: null, pendingResult: null })}
                className={btnGhost + ' text-left'}>
                <span className="text-base">🧙</span> Wizard
              </button>
            )}

            <button onClick={() => setModal({ type: 'sentoff', step: 0, eventTurn: null, team: null, playerId: null, bribeId: null, outcome: null })}
              className={btnGhost + ' text-left'}>
              <span className="text-base">🟥</span> Sent Off
            </button>

            {chefAvailable && (
              <button onClick={() => setModal({ type: 'chef', half: null, side: null, successes: null })}
                className={btnGhost + ' text-left'}>
                <span className="text-base">👨‍🍳</span> Chef
              </button>
            )}

            {cardAvailable && (
              <button onClick={() => setModal({ type: 'specialCard', step: 0, eventTurn: null, side: null, slotId: null, cardId: null })}
                className={btnGhost + ' text-left'}>
                <span className="text-base">🃏</span> Special Card
              </button>
            )}

            <div className="mt-auto space-y-2 pt-4 border-t border-bb-border">
              <button onClick={() => setModal({ type: 'inducements' })}
                className={btnGhost + ' w-full justify-center'}>
                📜 Inducements
              </button>
              {!hasHalftime && (
                <button onClick={() => {
                  pushEvent({ id: uid(), type: 'HALFTIME', label: '─── Half Time ───' })
                  // CRP1: whoever didn't kick in the 1st half automatically kicks in the 2nd —
                  // no new coin toss.
                  const secondHalfKicker = state.firstKickingTeam === 'home' ? 'away' : 'home'
                  setState((prev) => ({ ...prev, pendingKickoff: true }))
                  setModal(freshKickoffModal({ step: 'setup', isFirstKickoff: false, kickingTeam: secondHalfKicker }))
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
                        : event.type === 'SPECIAL_CARD'
                        ? 'border-purple-700/40 bg-purple-900/10 text-white'
                        : event.type === 'KICKOFF'
                        ? 'border-sky-700/40 bg-sky-900/10 text-white'
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
            {modal.step === 0 && (
              <>
                <p className="text-bb-muted text-sm">Which turn did the touchdown happen?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(hasHalftime ? [9,10,11,12,13,14,15,16] : [1,2,3,4,5,6,7,8]).map((t) => (
                    <button key={t} onClick={() => setModal({ ...modal, step: 1, eventTurn: t })}
                      className="py-2 rounded-sm border border-bb-border text-sm font-heading font-bold text-white hover:border-bb-gold hover:bg-bb-gold/10 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team scored? <span className="text-bb-gold font-heading">T{modal.eventTurn}</span></p>
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
                <button onClick={() => setModal({ ...modal, step: 0 })} className={btnGhost}>← Back</button>
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
            {modal.step === 0 && (
              <>
                <p className="text-bb-muted text-sm">Which turn did the casualty happen?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(hasHalftime ? [9,10,11,12,13,14,15,16] : [1,2,3,4,5,6,7,8]).map((t) => (
                    <button key={t} onClick={() => setModal({ ...modal, step: 1, eventTurn: t })}
                      className="py-2 rounded-sm border border-bb-border text-sm font-heading font-bold text-white hover:border-bb-crimson hover:bg-bb-crimson/10 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team caused the casualty? <span className="text-bb-gold font-heading">T{modal.eventTurn}</span></p>
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
                <button onClick={() => setModal({ ...modal, step: 0 })} className={btnGhost}>← Back</button>
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
                  {(['KO', 'BH', 'MNG', 'NIGGLING', 'DEAD'] as CasualtyResult[]).map((r) => (
                    <button key={r} onClick={() => setModal({ ...modal, result: r })}
                      className={`p-3 rounded-sm border text-sm font-heading font-bold uppercase tracking-wider transition-colors ${
                        modal.result === r
                          ? 'bg-bb-crimson border-bb-crimson text-white'
                          : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'
                      }`}>
                      {r === 'KO' ? '🌀 KO' : r === 'BH' ? '🤕 Badly Hurt' : r === 'MNG' ? '🏥 MNG' : r === 'NIGGLING' ? '🩹 Niggling' : '💀 Dead'}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 3 })} className={btnGhost}>← Back</button>
                  <button
                    onClick={() => {
                      const victimSide = modal.victimId ? playerTeam.get(modal.victimId) : undefined
                      const medOptions = victimSide ? availableMedical(victimSide) : []
                      if (medOptions.length > 0) setModal({ ...modal, step: 5 })
                      else commitCasualty()
                    }}
                    disabled={!modal.result}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    {modal.victimId && availableMedical(playerTeam.get(modal.victimId) ?? 'home').length > 0 ? 'Next →' : 'Confirm'}
                  </button>
                </div>
              </>
            )}
            {modal.step === 5 && modal.victimId && (
              <>
                <p className="text-bb-muted text-sm">Use medical staff to try to save them?</p>
                <div className="space-y-2">
                  <button onClick={() => setModal({ ...modal, medical: null })}
                    className={`w-full p-3 rounded-sm border text-sm font-heading text-left transition-colors ${
                      modal.medical === null ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'
                    }`}>
                    None
                  </button>
                  {availableMedical(playerTeam.get(modal.victimId)!).map((opt) => {
                    const key = opt.id ?? opt.kind
                    const isSelected = modal.medical?.kind === opt.kind && modal.medical?.id === opt.id
                    return (
                      <button key={key} onClick={() => setModal({ ...modal, medical: opt })}
                        className={`w-full p-3 rounded-sm border text-sm font-heading text-left transition-colors ${
                          isSelected ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'
                        }`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 4 })} className={btnGhost}>← Back</button>
                  <button onClick={commitCasualty}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest">
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
            {modal.step === 0 && (
              <>
                <p className="text-bb-muted text-sm">Which turn did the interception happen?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(hasHalftime ? [9,10,11,12,13,14,15,16] : [1,2,3,4,5,6,7,8]).map((t) => (
                    <button key={t} onClick={() => setModal({ ...modal, step: 1, eventTurn: t })}
                      className="py-2 rounded-sm border border-bb-border text-sm font-heading font-bold text-white hover:border-bb-gold/50 hover:bg-bb-gold/10 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team made the interception? <span className="text-bb-gold font-heading">T{modal.eventTurn}</span></p>
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
                <button onClick={() => setModal({ ...modal, step: 0 })} className={btnGhost}>← Back</button>
              </>
            )}
            {modal.step === 2 && modal.team && (
              <>
                <p className="text-bb-muted text-sm">Who made the interception? <span className="text-bb-gold font-heading">T{modal.eventTurn}</span></p>
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

        {/* Wizard Modal */}
        {modal?.type === 'wizard' && (
          <ModalOverlay title="Use Wizard" onClose={() => setModal(null)}>
            {modal.step === 0 && (
              <>
                <p className="text-bb-muted text-sm">Which turn is the Wizard casting?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(hasHalftime ? [9,10,11,12,13,14,15,16] : [1,2,3,4,5,6,7,8]).map((t) => (
                    <button key={t} onClick={() => setModal({ ...modal, step: 1, eventTurn: t })}
                      className="py-2 rounded-sm border border-bb-border text-sm font-heading font-bold text-white hover:border-bb-gold hover:bg-bb-gold/10 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team&apos;s Wizard?</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['home', 'away'] as const).map((side) => {
                    const team      = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    const purchased = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
                    const available = purchased.some((p) => p.name === 'Wizards' && !p.used)
                    return (
                      <button key={side} disabled={!available} onClick={() => setModal({ ...modal, step: 2, side })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed">
                        <div className="font-heading font-bold text-white text-sm">{team.name}</div>
                        <div className="text-xs text-bb-muted mt-1">{available ? 'Wizard available' : 'No Wizard'}</div>
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => setModal({ ...modal, step: 0 })} className={btnGhost}>← Back</button>
              </>
            )}
            {modal.step === 2 && (
              <>
                <p className="text-bb-muted text-sm">Which spell?</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setModal({ ...modal, step: 3, spell: 'fireball' })}
                    className="p-4 border border-bb-border rounded-sm hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors text-center">
                    <div className="font-heading font-bold text-white text-sm">🔥 Fireball</div>
                  </button>
                  <button onClick={() => setModal({ ...modal, step: 3, spell: 'lightning' })}
                    className="p-4 border border-bb-border rounded-sm hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors text-center">
                    <div className="font-heading font-bold text-white text-sm">⚡ Lightning Bolt</div>
                  </button>
                </div>
                <button onClick={() => setModal({ ...modal, step: 1 })} className={btnGhost}>← Back</button>
              </>
            )}
            {modal.step === 3 && modal.spell === 'lightning' && (
              <>
                <p className="text-bb-muted text-sm">Which player was hit?</p>
                <select
                  value={modal.pendingPlayerId ?? ''}
                  onChange={(e) => setModal({ ...modal, pendingPlayerId: e.target.value })}
                  className="w-full bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold"
                >
                  <option value="">Select player…</option>
                  {(['home', 'away'] as const).map((side) => {
                    const team    = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    const players = side === 'home' ? homePlaying : awayPlaying
                    return (
                      <optgroup key={side} label={`── ${team.name} ──`}>
                        {players.map((p) => (<option key={p.id} value={p.id}>{playerLabelFull(p)}</option>))}
                      </optgroup>
                    )
                  })}
                </select>
                {modal.pendingPlayerId && (
                  <div className="grid grid-cols-2 gap-2">
                    {(['KO', 'BH', 'MNG', 'NIGGLING', 'DEAD'] as CasualtyResult[]).map((r) => (
                      <button key={r} onClick={() => setModal({ ...modal, pendingResult: r })}
                        className={`p-3 rounded-sm border text-sm font-heading font-bold uppercase tracking-wider transition-colors ${
                          modal.pendingResult === r ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'
                        }`}>
                        {r === 'KO' ? '🌀 KO' : r === 'BH' ? '🤕 Badly Hurt' : r === 'MNG' ? '🏥 MNG' : r === 'NIGGLING' ? '🩹 Niggling' : '💀 Dead'}
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 2 })} className={btnGhost}>← Back</button>
                  <button
                    onClick={() => commitWizardEffect([{ playerId: modal.pendingPlayerId!, result: modal.pendingResult! }])}
                    disabled={!modal.pendingPlayerId || !modal.pendingResult}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Confirm
                  </button>
                </div>
              </>
            )}
            {modal.step === 3 && modal.spell === 'fireball' && (
              <>
                <p className="text-bb-muted text-sm">Add each player caught in the blast:</p>
                {modal.victims.length > 0 && (
                  <div className="space-y-1.5">
                    {modal.victims.map((v, i) => {
                      const p    = playerById.get(v.playerId)!
                      const team = playerTeam.get(v.playerId) === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
                      return (
                        <div key={i} className="flex items-center justify-between gap-2 px-3 py-2 border border-bb-border/50 rounded-sm">
                          <span className="text-sm text-white">{playerLabel(p)} ({team}) — {v.result}</span>
                          <button onClick={() => setModal({ ...modal, victims: modal.victims.filter((_, j) => j !== i) })}
                            className="text-bb-muted hover:text-bb-crimson text-sm">✕</button>
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="border-t border-bb-border pt-3 space-y-2">
                  <select
                    value={modal.pendingPlayerId ?? ''}
                    onChange={(e) => setModal({ ...modal, pendingPlayerId: e.target.value })}
                    className="w-full bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold"
                  >
                    <option value="">Add a player…</option>
                    {(['home', 'away'] as const).map((side) => {
                      const team    = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                      const players = side === 'home' ? homePlaying : awayPlaying
                      return (
                        <optgroup key={side} label={`── ${team.name} ──`}>
                          {players.map((p) => (<option key={p.id} value={p.id}>{playerLabelFull(p)}</option>))}
                        </optgroup>
                      )
                    })}
                  </select>
                  {modal.pendingPlayerId && (
                    <div className="grid grid-cols-2 gap-2">
                      {(['KO', 'BH', 'MNG', 'NIGGLING', 'DEAD'] as CasualtyResult[]).map((r) => (
                        <button key={r} onClick={() => setModal({ ...modal, pendingResult: r })}
                          className={`p-3 rounded-sm border text-sm font-heading font-bold uppercase tracking-wider transition-colors ${
                            modal.pendingResult === r ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'
                          }`}>
                          {r === 'KO' ? '🌀 KO' : r === 'BH' ? '🤕 Badly Hurt' : r === 'MNG' ? '🏥 MNG' : r === 'NIGGLING' ? '🩹 Niggling' : '💀 Dead'}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    disabled={!modal.pendingPlayerId || !modal.pendingResult}
                    onClick={() => setModal({
                      ...modal,
                      victims: [...modal.victims, { playerId: modal.pendingPlayerId!, result: modal.pendingResult! }],
                      pendingPlayerId: null, pendingResult: null,
                    })}
                    className={btnGhost + ' w-full justify-center disabled:opacity-40'}>
                    + Add Player
                  </button>
                </div>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 2 })} className={btnGhost}>← Back</button>
                  <button onClick={() => commitWizardEffect()} disabled={modal.victims.length === 0}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Confirm Spell
                  </button>
                </div>
              </>
            )}
          </ModalOverlay>
        )}

        {/* Sent Off Modal */}
        {modal?.type === 'sentoff' && (
          <ModalOverlay title="Record Sent Off" onClose={() => setModal(null)}>
            {modal.step === 0 && (
              <>
                <p className="text-bb-muted text-sm">Which turn was the player sent off?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(hasHalftime ? [9,10,11,12,13,14,15,16] : [1,2,3,4,5,6,7,8]).map((t) => (
                    <button key={t} onClick={() => setModal({ ...modal, step: 1, eventTurn: t })}
                      className="py-2 rounded-sm border border-bb-border text-sm font-heading font-bold text-white hover:border-bb-crimson hover:bg-bb-crimson/10 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team?</p>
                <div className="grid grid-cols-2 gap-3">
                  {(['home', 'away'] as const).map((side) => {
                    const team = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    return (
                      <button key={side} onClick={() => setModal({ ...modal, team: side })}
                        className={`p-4 border rounded-sm transition-colors text-center ${modal.team === side ? 'border-bb-crimson bg-bb-crimson/10' : 'border-bb-border hover:border-bb-crimson hover:bg-bb-crimson/5'}`}>
                        <div className="font-heading font-bold text-white text-sm">{team.name}</div>
                        <div className="text-xs text-bb-muted mt-1">{team.raceName}</div>
                      </button>
                    )
                  })}
                </div>
                {modal.team && (
                  <SelectPlayer
                    players={modal.team === 'home' ? homePlaying : awayPlaying}
                    value={modal.playerId ?? ''}
                    onChange={(v) => setModal({ ...modal, playerId: v })}
                    placeholder="Select player…"
                  />
                )}
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, step: 0 })} className={btnGhost}>← Back</button>
                  <button onClick={() => setModal({ ...modal, step: 2 })} disabled={!modal.team || !modal.playerId}
                    className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Next →
                  </button>
                </div>
              </>
            )}
            {modal.step === 2 && modal.team && (() => {
              const purchased = modal.team === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
              const bribes = purchased.filter((p) => p.name === 'Bribes' && !p.used)
              return (
                <>
                  <p className="text-bb-muted text-sm">Use a bribe to try to keep them on the field?</p>
                  <div className="space-y-2">
                    <button onClick={() => setModal({ ...modal, bribeId: null, outcome: null })}
                      className={`w-full p-3 rounded-sm border text-sm font-heading text-left transition-colors ${modal.bribeId === null ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'}`}>
                      No bribe
                    </button>
                    {bribes.length === 0 && (
                      <p className="text-xs text-bb-muted italic">No unused bribes available for this team.</p>
                    )}
                    {bribes.map((b, i) => (
                      <button key={b.id} onClick={() => setModal({ ...modal, bribeId: b.id })}
                        className={`w-full p-3 rounded-sm border text-sm font-heading text-left transition-colors ${modal.bribeId === b.id ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'}`}>
                        Bribe #{i + 1}
                      </button>
                    ))}
                  </div>
                  {modal.bribeId && (
                    <div className="grid grid-cols-2 gap-2">
                      <button onClick={() => setModal({ ...modal, outcome: 'success' })}
                        className={`p-3 rounded-sm border text-xs font-heading uppercase tracking-wider transition-colors ${modal.outcome === 'success' ? 'bg-bb-gold border-bb-gold text-bb-dark' : 'border-bb-border text-bb-muted hover:border-bb-gold hover:text-white'}`}>
                        Successful
                      </button>
                      <button onClick={() => setModal({ ...modal, outcome: 'failed' })}
                        className={`p-3 rounded-sm border text-xs font-heading uppercase tracking-wider transition-colors ${modal.outcome === 'failed' ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted hover:border-bb-crimson hover:text-white'}`}>
                        Failed (rolled a 1)
                      </button>
                    </div>
                  )}
                  <div className="flex justify-between pt-1">
                    <button onClick={() => setModal({ ...modal, step: 1 })} className={btnGhost}>← Back</button>
                    <button onClick={commitSentOff} disabled={Boolean(modal.bribeId) && !modal.outcome}
                      className="px-4 py-2 bg-bb-crimson text-white rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                      Confirm
                    </button>
                  </div>
                </>
              )
            })()}
          </ModalOverlay>
        )}

        {/* Chef Modal */}
        {modal?.type === 'chef' && (
          <ModalOverlay title="Use Halfling Master Chef" onClose={() => setModal(null)}>
            {modal.half === null ? (
              <>
                <p className="text-bb-muted text-sm">Which team and half?</p>
                <div className="space-y-2">
                  {(['home', 'away'] as const).flatMap((side) => {
                    const team      = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    const purchased = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
                    const chef      = purchased.find((p) => p.name === 'Halfling Master Chef')
                    if (!chef) return []
                    return ([1, 2] as const)
                      .filter((h) => (h === 1 ? !chef.chefHalf1Used : !chef.chefHalf2Used))
                      .map((h) => (
                        <button key={`${side}-${h}`} onClick={() => setModal({ ...modal, half: h, side })}
                          className="w-full p-3 rounded-sm border border-bb-border text-sm font-heading text-left hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors">
                          {team.name} — Half {h}
                        </button>
                      ))
                  })}
                </div>
                {(['home', 'away'] as const).every((side) => {
                  const purchased = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
                  const chef = purchased.find((p) => p.name === 'Halfling Master Chef')
                  return !chef || (chef.chefHalf1Used && chef.chefHalf2Used)
                }) && (
                  <p className="text-xs text-bb-muted italic">No team has an available, unused Halfling Master Chef for either half.</p>
                )}
              </>
            ) : (
              <>
                <p className="text-bb-muted text-sm">How many of the 3 dice rolled 4+?</p>
                <div className="grid grid-cols-4 gap-2">
                  {[0, 1, 2, 3].map((n) => (
                    <button key={n} onClick={() => setModal({ ...modal, successes: n })}
                      className={`p-3 rounded-sm border text-sm font-heading font-bold transition-colors ${
                        modal.successes === n ? 'bg-bb-gold border-bb-gold text-bb-dark' : 'border-bb-border text-bb-muted hover:border-bb-gold hover:text-white'
                      }`}>
                      {n}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between pt-1">
                  <button onClick={() => setModal({ ...modal, half: null, side: null })} className={btnGhost}>← Back</button>
                  <button onClick={commitChef} disabled={modal.successes === null}
                    className="px-4 py-2 bg-bb-gold text-bb-dark rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                    Confirm
                  </button>
                </div>
              </>
            )}
          </ModalOverlay>
        )}

        {modal?.type === 'specialCard' && (
          <ModalOverlay title="Play Special Card" onClose={() => setModal(null)}>
            {modal.step === 0 && (
              <>
                <p className="text-bb-muted text-sm">Which turn is this card played on?</p>
                <div className="grid grid-cols-4 gap-2">
                  {(hasHalftime ? [9,10,11,12,13,14,15,16] : [1,2,3,4,5,6,7,8]).map((t) => (
                    <button key={t} onClick={() => setModal({ ...modal, step: 1, eventTurn: t })}
                      className="py-2 rounded-sm border border-bb-border text-sm font-heading font-bold text-white hover:border-bb-gold hover:bg-bb-gold/10 transition-colors">
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
            {modal.step === 1 && (
              <>
                <p className="text-bb-muted text-sm">Which team? <span className="text-bb-gold font-heading">T{modal.eventTurn}</span></p>
                <div className="grid grid-cols-2 gap-3">
                  {(['home', 'away'] as const).map((side) => {
                    const team      = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                    const available = (side === 'home' ? matchData.homeSpecialPlayCards : matchData.awaySpecialPlayCards).some((s) => !s.cardId)
                    return (
                      <button key={side} disabled={!available} onClick={() => setModal({ ...modal, step: 2, side })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors text-center disabled:opacity-30 disabled:cursor-not-allowed">
                        <div className="font-heading font-bold text-white text-sm">{team.name}</div>
                        <div className="text-xs text-bb-muted mt-1">{available ? 'Card available' : 'No undrawn card'}</div>
                      </button>
                    )
                  })}
                </div>
                <button onClick={() => setModal({ ...modal, step: 0 })} className={btnGhost}>← Back</button>
              </>
            )}
            {modal.step === 2 && modal.side && (() => {
              const slots = (modal.side === 'home' ? matchData.homeSpecialPlayCards : matchData.awaySpecialPlayCards)
                .filter((s) => !s.cardId)
              return (
                <>
                  <p className="text-bb-muted text-sm">Which draw is being played?</p>
                  <div className="space-y-2">
                    {slots.map((s) => (
                      <button key={s.id} onClick={() => setModal({ ...modal, step: 3, slotId: s.id })}
                        className="w-full p-3 rounded-sm border border-bb-border text-sm font-heading text-left hover:border-bb-gold/50 hover:bg-bb-gold/5 transition-colors">
                        {s.deckName} <span className="text-bb-muted text-xs">({s.cost.toLocaleString()} gp)</span>
                      </button>
                    ))}
                  </div>
                  <button onClick={() => setModal({ ...modal, step: 1, side: null })} className={btnGhost}>← Back</button>
                </>
              )
            })()}
            {modal.step === 3 && modal.side && modal.slotId && (() => {
              const slot = (modal.side === 'home' ? matchData.homeSpecialPlayCards : matchData.awaySpecialPlayCards)
                .find((s) => s.id === modal.slotId)
              const deck = matchData.specialPlayDecks.find((d) => d.id === slot?.deckId)
              const card = deck?.cards.find((c) => c.id === modal.cardId)
              return (
                <>
                  <p className="text-bb-muted text-sm">Which card from the {deck?.name} deck was drawn?</p>
                  <select
                    value={modal.cardId ?? ''}
                    onChange={(e) => setModal({ ...modal, cardId: e.target.value || null })}
                    className="w-full bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold"
                  >
                    <option value="">Select card…</option>
                    {deck?.cards.map((c) => (
                      <option key={c.id} value={c.id}>{c.cardLabel}: {c.name}</option>
                    ))}
                  </select>
                  {card && (
                    <div className="text-[11px] text-bb-muted/90 leading-relaxed bg-bb-darker border border-bb-border/40 rounded-sm px-3 py-2 space-y-1.5">
                      <p><span className="text-bb-gold font-heading uppercase tracking-wider text-[10px]">Description</span><br />{card.description}</p>
                      <p><span className="text-bb-gold font-heading uppercase tracking-wider text-[10px]">Timing</span><br />{card.timing}</p>
                      <p><span className="text-bb-gold font-heading uppercase tracking-wider text-[10px]">Effect</span><br />{card.effect}</p>
                    </div>
                  )}
                  <div className="flex justify-between pt-1">
                    <button onClick={() => setModal({ ...modal, step: 2, slotId: null, cardId: null })} className={btnGhost}>← Back</button>
                    <button onClick={commitSpecialPlayCard} disabled={!modal.cardId}
                      className="px-4 py-2 bg-bb-gold text-bb-dark rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                      Confirm
                    </button>
                  </div>
                </>
              )
            })()}
          </ModalOverlay>
        )}

        {modal?.type === 'kickoff' && (
          <ModalOverlay title="Kick-Off" onClose={() => {}}>
            {modal.step === 'confirmNeeded' && (
              <>
                <p className="text-bb-muted text-sm">Touchdown recorded. Are there still turns remaining in this half?</p>
                <div className="flex gap-3">
                  <button onClick={() => setModal({ ...modal, step: 'setup' })}
                    className="flex-1 px-4 py-3 bg-bb-crimson text-white rounded-sm text-sm font-heading uppercase tracking-widest">
                    Yes — Kick Off Again
                  </button>
                  <button onClick={() => setModal(null)}
                    className="flex-1 px-4 py-3 border border-bb-border text-bb-muted rounded-sm text-sm font-heading uppercase tracking-widest">
                    No — Half Over
                  </button>
                </div>
              </>
            )}

            {modal.step === 'toss' && (
              <>
                <p className="text-bb-muted text-sm leading-relaxed">
                  <span className="text-bb-gold font-heading uppercase tracking-wider text-[10px] block mb-1">CRP1 — Setting Up</span>
                  Flip a coin or roll a D6 to see who chooses. The winner sets up first as the <b className="text-white">Kicking Team</b> (they kick the ball), or second as the <b className="text-white">Receiving Team</b>.
                </p>
                {modal.tossWinner === null ? (
                  <div className="grid grid-cols-2 gap-3">
                    {(['home', 'away'] as const).map((side) => (
                      <button key={side} onClick={() => setModal({ ...modal, tossWinner: side })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-gold hover:bg-bb-gold/5 transition-colors text-center">
                        <div className="font-heading font-bold text-white text-sm">{side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name}</div>
                        <div className="text-xs text-bb-muted mt-1">won the toss</div>
                      </button>
                    ))}
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-white">{modal.tossWinner === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name} won the toss — kick or receive?</p>
                    <div className="grid grid-cols-2 gap-3">
                      <button onClick={() => setModal({ ...modal, step: 'setup', kickingTeam: modal.tossWinner })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-gold hover:bg-bb-gold/5 transition-colors text-center font-heading text-white text-sm">
                        ⚽ Kick
                      </button>
                      <button onClick={() => setModal({ ...modal, step: 'setup', kickingTeam: modal.tossWinner === 'home' ? 'away' : 'home' })}
                        className="p-4 border border-bb-border rounded-sm hover:border-bb-gold hover:bg-bb-gold/5 transition-colors text-center font-heading text-white text-sm">
                        🤲 Receive
                      </button>
                    </div>
                    <button onClick={() => setModal({ ...modal, tossWinner: null })} className={btnGhost}>← Back</button>
                  </>
                )}
              </>
            )}

            {modal.step === 'setup' && (
              <>
                <p className="text-bb-muted text-sm leading-relaxed">
                  <span className="text-bb-gold font-heading uppercase tracking-wider text-[10px] block mb-1">CRP1 — Setup</span>
                  The <b className="text-white">Kicking Team</b> ({modal.kickingTeam ? (modal.kickingTeam === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name) : '—'}) sets up first, then the <b className="text-white">Receiving Team</b> ({modal.kickingTeam ? (modal.kickingTeam === 'home' ? matchData.awayTeam.name : matchData.homeTeam.name) : '—'}). Each coach sets up up to 11 players between their end zone and the halfway line.
                </p>
                <button onClick={() => setModal({ ...modal, step: 'roll' })}
                  className="w-full px-4 py-3 bg-bb-gold text-bb-dark rounded-sm text-sm font-heading uppercase tracking-widest">
                  Teams Are Set Up →
                </button>
              </>
            )}

            {modal.step === 'roll' && modal.kickingTeam && (() => {
              const kickingName   = modal.kickingTeam === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
              const receivingName = modal.kickingTeam === 'home' ? matchData.awayTeam.name : matchData.homeTeam.name
              return (
                <>
                  <p className="text-bb-muted text-sm leading-relaxed">
                    <span className="text-bb-gold font-heading uppercase tracking-wider text-[10px] block mb-1">CRP1 — Kick-Off</span>
                    {kickingName} places the ball anywhere in {receivingName}&rsquo;s half, then it scatters (D8 for direction, D6 for squares). Roll 2D6 on the Kick-Off Table.
                  </p>
                  <p className="text-bb-muted text-sm">Which turn is this?</p>
                  <div className="grid grid-cols-4 gap-2">
                    {(hasHalftime ? [9,10,11,12,13,14,15,16] : [1,2,3,4,5,6,7,8]).map((t) => (
                      <button key={t} onClick={() => setModal({ ...modal, eventTurn: t })}
                        className={`py-2 rounded-sm border text-sm font-heading font-bold transition-colors ${
                          modal.eventTurn === t ? 'bg-bb-gold border-bb-gold text-bb-dark' : 'border-bb-border text-white hover:border-bb-gold hover:bg-bb-gold/10'
                        }`}>
                        {t}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <select value={modal.die1} onChange={(e) => setModal({ ...modal, die1: e.target.value ? parseInt(e.target.value, 10) : '' })}
                      className="bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold">
                      <option value="" disabled>D1</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                    <span className="text-bb-muted">+</span>
                    <select value={modal.die2} onChange={(e) => setModal({ ...modal, die2: e.target.value ? parseInt(e.target.value, 10) : '' })}
                      className="bg-bb-darker border border-bb-border rounded-sm px-3 py-2 text-sm text-white focus:outline-none focus:border-bb-gold">
                      <option value="" disabled>D2</option>
                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <button disabled={!modal.eventTurn || modal.die1 === '' || modal.die2 === ''}
                    onClick={() => setModal({ ...modal, step: 'resolve' })}
                    className="w-full px-4 py-3 bg-bb-gold text-bb-dark rounded-sm text-sm font-heading uppercase tracking-widest disabled:opacity-40 disabled:cursor-not-allowed">
                    Roll →
                  </button>
                </>
              )
            })()}

            {modal.step === 'resolve' && modal.kickingTeam && modal.die1 !== '' && modal.die2 !== '' && (() => {
              const dieRoll = modal.die1 as number + (modal.die2 as number)
              const result = matchData.kickoffTable.find((r) => r.dieRoll === dieRoll)
              const receivingTeam = modal.kickingTeam === 'home' ? 'away' : 'home'
              const homePlayers = homePlaying
              const awayPlayers = awayPlaying
              const canConfirm = (() => {
                if (dieRoll === 11) {
                  const homeTotal = (modal.rockHomeDie || 0) + homeKickoffFame
                  const awayTotal = (modal.rockAwayDie || 0) + awayKickoffFame
                  if (modal.rockHomeDie === '' || modal.rockAwayDie === '') return false
                  const tie = homeTotal === awayTotal
                  if (!modal.rockVictimId || !modal.rockResult) return false
                  if (tie && (!modal.rockVictimId2 || !modal.rockResult2)) return false
                  return true
                }
                if (dieRoll === 7) return modal.weatherDie1 !== '' && modal.weatherDie2 !== ''
                return true
              })()
              return (
                <>
                  <div className="bg-bb-darker border border-bb-border rounded-sm px-4 py-3">
                    <p className="font-heading text-bb-gold font-bold text-sm">{result?.name ?? `Result ${dieRoll}`}</p>
                    <p className="text-xs text-bb-muted mt-1 leading-relaxed">{result?.description}</p>
                  </div>

                  {dieRoll === 3 && (
                    <div className="space-y-2">
                      <p className="text-bb-muted text-sm">What turn is the receiving team on this half?</p>
                      <div className="grid grid-cols-4 gap-2">
                        <button onClick={() => setModal({ ...modal, riotTurn: 'none' })}
                          className={`col-span-2 py-2 rounded-sm border text-xs font-heading uppercase ${modal.riotTurn === 'none' ? 'bg-bb-gold border-bb-gold text-bb-dark' : 'border-bb-border text-white'}`}>
                          Hasn&rsquo;t had a turn
                        </button>
                        {[1,2,3,4,5,6,7].map((t) => (
                          <button key={t} onClick={() => setModal({ ...modal, riotTurn: t })}
                            className={`py-2 rounded-sm border text-sm font-heading font-bold ${modal.riotTurn === t ? 'bg-bb-gold border-bb-gold text-bb-dark' : 'border-bb-border text-white'}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                      {modal.riotTurn !== 'none' && modal.riotTurn !== 7 && modal.riotTurn !== '' && (
                        <div className="flex items-center gap-2">
                          <span className="text-bb-muted text-xs">D6 roll:</span>
                          <select value={modal.riotD6} onChange={(e) => setModal({ ...modal, riotD6: e.target.value ? parseInt(e.target.value, 10) : '' })}
                            className="bg-bb-darker border border-bb-border rounded-sm px-2 py-1 text-xs text-white">
                            <option value="" disabled>D6</option>
                            {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                          </select>
                        </div>
                      )}
                    </div>
                  )}

                  {dieRoll === 5 && (
                    <SelectPlayer
                      players={receivingTeam === 'home' ? homePlayers : awayPlayers}
                      value={modal.movedPlayerId ?? ''}
                      onChange={(v) => setModal({ ...modal, movedPlayerId: v || null })}
                      placeholder="Which player was repositioned? (optional)"
                    />
                  )}

                  {(dieRoll === 6 || dieRoll === 8) && (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <p className="text-xs text-bb-muted">{matchData.homeTeam.name} D3</p>
                        <select value={modal.homeCompareDie} onChange={(e) => setModal({ ...modal, homeCompareDie: e.target.value ? parseInt(e.target.value, 10) : '' })}
                          className="w-full bg-bb-darker border border-bb-border rounded-sm px-2 py-1.5 text-sm text-white">
                          <option value="" disabled>D3</option>
                          {[1,2,3].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <p className="text-[10px] text-bb-muted/60">+ FAME {homeKickoffFame} + {dieRoll === 6 ? `Cheer ${matchData.homeCheerleaders}` : `Coach ${matchData.homeAssistantCoaches}`}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs text-bb-muted">{matchData.awayTeam.name} D3</p>
                        <select value={modal.awayCompareDie} onChange={(e) => setModal({ ...modal, awayCompareDie: e.target.value ? parseInt(e.target.value, 10) : '' })}
                          className="w-full bg-bb-darker border border-bb-border rounded-sm px-2 py-1.5 text-sm text-white">
                          <option value="" disabled>D3</option>
                          {[1,2,3].map((n) => <option key={n} value={n}>{n}</option>)}
                        </select>
                        <p className="text-[10px] text-bb-muted/60">+ FAME {awayKickoffFame} + {dieRoll === 6 ? `Cheer ${matchData.awayCheerleaders}` : `Coach ${matchData.awayAssistantCoaches}`}</p>
                      </div>
                    </div>
                  )}

                  {dieRoll === 7 && (
                    <div className="flex items-center gap-3">
                      <span className="text-bb-muted text-xs">Re-roll weather:</span>
                      <select value={modal.weatherDie1} onChange={(e) => setModal({ ...modal, weatherDie1: e.target.value ? parseInt(e.target.value, 10) : '' })}
                        className="bg-bb-darker border border-bb-border rounded-sm px-2 py-1 text-xs text-white">
                        <option value="" disabled>D1</option>
                        {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                      <span className="text-bb-muted">+</span>
                      <select value={modal.weatherDie2} onChange={(e) => setModal({ ...modal, weatherDie2: e.target.value ? parseInt(e.target.value, 10) : '' })}
                        className="bg-bb-darker border border-bb-border rounded-sm px-2 py-1 text-xs text-white">
                        <option value="" disabled>D2</option>
                        {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                      </select>
                    </div>
                  )}

                  {dieRoll === 10 && (
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={modal.turnoverEndedEarly}
                        onChange={(e) => setModal({ ...modal, turnoverEndedEarly: e.target.checked })}
                        className="accent-bb-crimson w-4 h-4" />
                      <span className="text-sm text-white">Bonus turn ended early (a player suffered a turnover)</span>
                    </label>
                  )}

                  {dieRoll === 11 && (() => {
                    const homeTotal = (modal.rockHomeDie || 0) + homeKickoffFame
                    const awayTotal = (modal.rockAwayDie || 0) + awayKickoffFame
                    const tie = modal.rockHomeDie !== '' && modal.rockAwayDie !== '' && homeTotal === awayTotal
                    const thrower = !tie && modal.rockHomeDie !== '' && modal.rockAwayDie !== '' ? (homeTotal > awayTotal ? 'home' : 'away') : null
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs text-bb-muted">{matchData.homeTeam.name} D6 (+ FAME {homeKickoffFame})</p>
                            <select value={modal.rockHomeDie} onChange={(e) => setModal({ ...modal, rockHomeDie: e.target.value ? parseInt(e.target.value, 10) : '' })}
                              className="w-full bg-bb-darker border border-bb-border rounded-sm px-2 py-1.5 text-sm text-white">
                              <option value="" disabled>D6</option>
                              {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                          <div className="space-y-1">
                            <p className="text-xs text-bb-muted">{matchData.awayTeam.name} D6 (+ FAME {awayKickoffFame})</p>
                            <select value={modal.rockAwayDie} onChange={(e) => setModal({ ...modal, rockAwayDie: e.target.value ? parseInt(e.target.value, 10) : '' })}
                              className="w-full bg-bb-darker border border-bb-border rounded-sm px-2 py-1.5 text-sm text-white">
                              <option value="" disabled>D6</option>
                              {[1,2,3,4,5,6].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                          </div>
                        </div>
                        {tie && (
                          <p className="text-xs text-bb-gold">Tie — a rock is thrown at each team!</p>
                        )}
                        {(thrower === 'home' || tie) && (
                          <div className="space-y-1.5 border-t border-bb-border/40 pt-2">
                            <p className="text-xs text-bb-muted">{matchData.awayTeam.name} player hit:</p>
                            <SelectPlayer players={awayPlayers} value={modal.rockVictimId ?? ''}
                              onChange={(v) => setModal({ ...modal, rockVictimId: v || null })} placeholder="Select player…" />
                            {modal.rockVictimId && (
                              <div className="grid grid-cols-4 gap-1.5">
                                {(['BH','MNG','NIGGLING','DEAD'] as CasualtyResult[]).map((r) => (
                                  <button key={r} onClick={() => setModal({ ...modal, rockResult: r })}
                                    className={`py-1.5 rounded-sm border text-[10px] font-heading uppercase ${modal.rockResult === r ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted'}`}>
                                    {r === 'BH' ? 'Badly Hurt' : r === 'MNG' ? 'MNG' : r === 'NIGGLING' ? 'Niggling' : 'Dead'}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        {(thrower === 'away' || tie) && (
                          <div className="space-y-1.5 border-t border-bb-border/40 pt-2">
                            <p className="text-xs text-bb-muted">{matchData.homeTeam.name} player hit:</p>
                            <SelectPlayer players={homePlayers} value={modal.rockVictimId2 ?? ''}
                              onChange={(v) => setModal({ ...modal, rockVictimId2: v || null })} placeholder="Select player…" />
                            {modal.rockVictimId2 && (
                              <div className="grid grid-cols-4 gap-1.5">
                                {(['BH','MNG','NIGGLING','DEAD'] as CasualtyResult[]).map((r) => (
                                  <button key={r} onClick={() => setModal({ ...modal, rockResult2: r })}
                                    className={`py-1.5 rounded-sm border text-[10px] font-heading uppercase ${modal.rockResult2 === r ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted'}`}>
                                    {r === 'BH' ? 'Badly Hurt' : r === 'MNG' ? 'MNG' : r === 'NIGGLING' ? 'Niggling' : 'Dead'}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })()}

                  {dieRoll === 12 && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-xs text-bb-muted mb-1">{matchData.homeTeam.name} players Stunned:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {homePlayers.map((p) => {
                            const checked = modal.stunnedHomeIds.includes(p.id)
                            return (
                              <button key={p.id} onClick={() => setModal({ ...modal, stunnedHomeIds: checked ? modal.stunnedHomeIds.filter((id) => id !== p.id) : [...modal.stunnedHomeIds, p.id] })}
                                className={`text-[11px] px-2 py-1 rounded-sm border ${checked ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted'}`}>
                                {playerLabel(p)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-bb-muted mb-1">{matchData.awayTeam.name} players Stunned:</p>
                        <div className="flex flex-wrap gap-1.5">
                          {awayPlayers.map((p) => {
                            const checked = modal.stunnedAwayIds.includes(p.id)
                            return (
                              <button key={p.id} onClick={() => setModal({ ...modal, stunnedAwayIds: checked ? modal.stunnedAwayIds.filter((id) => id !== p.id) : [...modal.stunnedAwayIds, p.id] })}
                                className={`text-[11px] px-2 py-1 rounded-sm border ${checked ? 'bg-bb-crimson border-bb-crimson text-white' : 'border-bb-border text-bb-muted'}`}>
                                {playerLabel(p)}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="flex justify-between pt-1">
                    <button onClick={() => setModal({ ...modal, step: 'roll' })} className={btnGhost}>← Re-roll</button>
                    <button onClick={commitKickoff} disabled={!canConfirm}
                      className="px-4 py-2 bg-bb-gold text-bb-dark rounded-sm text-xs font-heading uppercase tracking-widest disabled:opacity-40">
                      Confirm
                    </button>
                  </div>
                </>
              )
            })()}
          </ModalOverlay>
        )}

        {modal?.type === 'inducements' && (
          <ModalOverlay title="Purchased Inducements" onClose={() => setModal(null)}>
            {matchData.homeInducementsPurchased.length === 0 && matchData.awayInducementsPurchased.length === 0 ? (
              <p className="text-bb-muted text-sm italic">No inducements purchased for this match.</p>
            ) : (
              (['home', 'away'] as const).map((side) => {
                const teamName = side === 'home' ? matchData.homeTeam.name : matchData.awayTeam.name
                const list     = side === 'home' ? matchData.homeInducementsPurchased : matchData.awayInducementsPurchased
                if (list.length === 0) return null
                return (
                  <div key={side}>
                    <p className="text-xs font-heading uppercase tracking-wider text-bb-gold mb-2">{teamName}</p>
                    <div className="space-y-2">
                      {list.map((ind) => {
                        const key    = `${ind.id}||live-rule`
                        const isOpen = openSkillKey === key
                        return (
                          <div key={ind.id} className="border border-bb-border/40 rounded-sm px-3 py-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-sm text-white">{ind.name}</span>
                              <button onClick={() => setOpenSkillKey(isOpen ? null : key)} className="text-[10px] px-1.5 py-1 rounded-sm border border-bb-gold/30 bg-bb-gold/10 text-bb-gold font-heading">
                                {isOpen ? 'Hide Rule' : 'View Rule'}
                              </button>
                            </div>
                            {isOpen && (
                              <div className="mt-1.5 text-[11px] text-bb-muted/90 leading-relaxed bg-bb-darker border border-bb-border/40 rounded-sm px-3 py-2 whitespace-pre-line">
                                {ind.rule}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
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
                        const v = e.target.value as 'BH' | 'MNG' | 'NIGGLING' | 'DEAD'
                        setState((prev) => ({
                          ...prev,
                          injuryOverrides: { ...prev.injuryOverrides, [player.id]: v },
                        }))
                      }}
                      className="bg-bb-dark border border-bb-border rounded-sm px-3 py-1.5 text-sm text-white focus:outline-none focus:border-bb-gold">
                      <option value="BH">Badly Hurt (no lasting effect)</option>
                      <option value="MNG">Miss Next Game</option>
                      <option value="NIGGLING">Niggling Injury</option>
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
          <p className="text-xs text-bb-muted mb-4">CRP1: 1D6 + FAME, ×10,000gp, +10,000gp if won or drawn — the winner may re-roll once but must keep the new result.</p>
          {(() => {
            const homeSpent = matchData.homeTeam.players.filter((p) => p.isMerc).reduce((s, p) => s + (p.mercCost ?? 0), 0)
                             + matchData.homeInducementsPurchased.reduce((s, p) => s + p.cost, 0)
            const awaySpent = matchData.awayTeam.players.filter((p) => p.isMerc).reduce((s, p) => s + (p.mercCost ?? 0), 0)
                             + matchData.awayInducementsPurchased.reduce((s, p) => s + p.cost, 0)
            const { homePettyCashReturned, awayPettyCashReturned } = computePettyCashReturn({
              homeTeamValue: matchData.homeBaseTeamValue,
              awayTeamValue: matchData.awayBaseTeamValue,
              homePettyCash: matchData.homePettyCash,
              awayPettyCash: matchData.awayPettyCash,
              homeSpent, awaySpent,
            })

            return (
              <div className="grid grid-cols-2 gap-4">
                {(['home', 'away'] as const).map((side) => {
                  const team    = side === 'home' ? matchData.homeTeam : matchData.awayTeam
                  const fame    = side === 'home' ? matchData.homeFame : matchData.awayFame
                  const won     = side === 'home' ? score.home > score.away : score.away > score.home
                  const isDraw  = score.home === score.away
                  const die         = side === 'home' ? homeWinDie      : awayWinDie
                  const setDie      = side === 'home' ? setHomeWinDie   : setAwayWinDie
                  const rerolled    = side === 'home' ? homeWinRerolled : awayWinRerolled
                  const setRerolled = side === 'home' ? setHomeWinRerolled : setAwayWinRerolled
                  const bonus = won || isDraw ? 10000 : 0
                  const dieNum = typeof die === 'number' ? die : 0
                  const computed = (fame !== null && die !== '') ? (dieNum + fame) * 10000 + bonus : null

                  const teamValue         = side === 'home' ? matchData.homeTeamValue    : matchData.awayTeamValue
                  const treasury          = side === 'home' ? matchData.homeTeamTreasury : matchData.awayTeamTreasury
                  const pettyCashReturned = side === 'home' ? homePettyCashReturned       : awayPettyCashReturned
                  const expense = spirallingExpenseFor(teamValue, matchData.spirallingExpenseTiers)
                  const available = computed !== null ? treasury + computed + pettyCashReturned : null
                  const expenseClamped = available !== null ? Math.min(expense, Math.max(0, available)) : null

                  return (
                    <div key={side}>
                      <label className="block text-xs text-bb-muted mb-1.5 font-heading uppercase tracking-wider">{team.name}</label>
                      {fame === null ? (
                        <p className="text-xs text-bb-muted/50 italic">Fans &amp; FAME not recorded for this match — cannot compute winnings.</p>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <select value={die} onChange={(e) => setDie(e.target.value ? parseInt(e.target.value, 10) : '')}
                              className="bg-bb-darker border border-bb-border rounded-sm px-2 py-1 text-xs text-white focus:outline-none focus:border-bb-gold">
                              <option value="" disabled>D6</option>
                              {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                            </select>
                            <span className="text-[11px] text-bb-muted">+ FAME {fame}</span>
                            {won && die !== '' && !rerolled && (
                              <button onClick={() => { setDie(''); setRerolled(true) }}
                                className="text-[10px] px-1.5 py-0.5 rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10">
                                Re-roll
                              </button>
                            )}
                          </div>
                          {computed === null ? (
                            <p className="text-xs text-bb-muted/50 italic">Enter the D6 roll to compute winnings.</p>
                          ) : (
                            <div className="bg-bb-darker border border-bb-border rounded-sm p-3 space-y-1">
                              <p className="text-xs text-bb-muted">
                                {dieNum} (D6) + {fame} (FAME) = {dieNum + fame} × 10,000gp = {((dieNum + fame) * 10000).toLocaleString()}gp
                              </p>
                              {bonus > 0 && (
                                <p className="text-xs text-bb-muted">+ {bonus.toLocaleString()}gp ({won ? 'Win' : 'Draw'} bonus)</p>
                              )}
                              <p className="text-lg font-heading font-black text-bb-gold">
                                Total: {computed.toLocaleString()}gp
                              </p>
                              {expense > 0 && expenseClamped !== null && (
                                <div className="pt-2 mt-2 border-t border-bb-border/40 space-y-1">
                                  <p className="text-xs text-bb-muted">
                                    Spiralling Expenses: {expense.toLocaleString()}gp
                                    {expenseClamped < expense && ` (capped at ${expenseClamped.toLocaleString()}gp — treasury floor)`}
                                  </p>
                                  <p className="text-xs text-bb-muted">
                                    Treasury after this match: {treasury.toLocaleString()} + {computed.toLocaleString()} + {pettyCashReturned.toLocaleString()} − {expenseClamped.toLocaleString()} = {(treasury + computed + pettyCashReturned - expenseClamped).toLocaleString()}gp
                                  </p>
                                </div>
                              )}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })()}
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
        <div className="flex flex-col items-center gap-2 pb-8">
          <button
            onClick={handleComplete}
            disabled={isPending || (matchData.homeFame !== null && homeWinDie === '') || (matchData.awayFame !== null && awayWinDie === '')}
            className="px-8 py-4 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold tracking-widest uppercase rounded-sm text-sm transition-colors disabled:opacity-50 shadow-lg shadow-bb-crimson/20">
            {isPending ? 'Saving…' : '⚔ Complete Match & Save Everything'}
          </button>
          {((matchData.homeFame !== null && homeWinDie === '') || (matchData.awayFame !== null && awayWinDie === '')) && (
            <p className="text-xs text-bb-muted">Enter both teams&rsquo; winnings D6 roll first</p>
          )}
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
