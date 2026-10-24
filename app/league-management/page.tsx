import Link from 'next/link'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { getMatchesByLeague } from '@/lib/queries/matches'
import {
  createLeague, renameLeague, toggleLeagueVisibility, deleteLeague,
  createSeason, renameSeason, setSeasonStatus, deleteSeason,
  createDivision, renameDivision, toggleDivisionVisibility, deleteDivision,
  assignTeamToDivision, removeTeamFromDivision,
} from './actions'
import {
  createTournament, renameTournament, toggleTournamentCrossDiv,
  addDivisionToTournament, removeDivisionFromTournament, deleteTournament,
} from './tournament-actions'
import {
  createRuleSet, updateRuleSet, toggleRuleSetStatus, deleteRuleSet, setLeagueRuleSet,
  addSpirallingExpenseTier, removeSpirallingExpenseTier, importDefaultSpirallingExpenseTiers,
} from './ruleset-actions'
import {
  createCoach, renameCoach, updateCoachEmail, resetCoachPassword,
  toggleCoachActive, deleteCoach, setCoachPrimaryLeague, setCoachRole,
  disableCoachMfa,
} from './coach-actions'
import MatchesTab from './MatchesTab'
import ResetLinkButton from './ResetLinkButton'

export const dynamic = 'force-dynamic'

// ── Display maps ─────────────────────────────────────────────────────────────

const SEASON_STATUS_LABELS: Record<string, string> = {
  PLANNING: 'Planning',
  READY:    'Ready for first gameday',
  ACTIVE:   'Season started',
  ENDED:    'Season ended',
}
const SEASON_STATUS_BADGE_CLS: Record<string, string> = {
  PLANNING: 'border-bb-muted/30 text-bb-muted bg-bb-muted/5',
  READY:    'border-green-700/50 text-green-400 bg-green-900/10',
  ACTIVE:   'border-bb-gold/40 text-bb-gold bg-bb-gold/5',
  ENDED:    'border-bb-crimson/50 text-bb-crimson-bright bg-bb-crimson/5',
}

const GAME_TYPE_LABELS: Record<string, string> = {
  BLOOD_BOWL:   'Blood Bowl',
  DUNGEON_BOWL: 'Dungeon Bowl',
  BB7:          'BB7',
}
const GAME_TYPE_BADGE_CLS: Record<string, string> = {
  BLOOD_BOWL:   'border-bb-crimson/50 text-bb-crimson-bright bg-bb-crimson/5',
  DUNGEON_BOWL: 'border-amber-700/50 text-amber-400 bg-amber-900/10',
  BB7:          'border-blue-700/50 text-blue-400 bg-blue-900/10',
}

const ROLE_BADGE_CLS: Record<string, string> = {
  ADMIN:   'border-bb-crimson/50 text-bb-crimson-bright bg-bb-crimson/5',
  COMMISH: 'border-bb-gold/40 text-bb-gold bg-bb-gold/5',
  COACH:   'border-bb-muted/30 text-bb-muted bg-bb-muted/5',
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function SectionHeading({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-4 mb-5">
      <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase whitespace-nowrap">{title}</h2>
      <div className="flex-1 h-px bg-bb-border" />
    </div>
  )
}

function HiddenBadge() {
  return (
    <span className="text-xs px-1.5 py-0.5 rounded-sm border border-bb-muted/30 text-bb-muted bg-bb-muted/5">
      Hidden
    </span>
  )
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

function inputCls(extra = '') {
  return `bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40 ${extra}`
}

function btnCls(variant: 'primary' | 'ghost' | 'danger' | 'muted' = 'ghost', extra = '') {
  const base = 'text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-bb-crimson hover:bg-bb-crimson-bright text-white',
    ghost:   'border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted',
    danger:  'border border-bb-crimson/40 text-bb-crimson-bright hover:bg-bb-crimson/20',
    muted:   'text-bb-muted/50 border border-bb-border/50',
  }
  return `${base} ${variants[variant]} ${extra}`
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface Props {
  searchParams: Promise<{ tab?: string; leagueId?: string; divisionId?: string; seasonId?: string }>
}

export default async function LeagueManagementPage({ searchParams }: Props) {
  const session = await getSession()
  const isAdmin = session?.role === 'ADMIN'

  const { tab: rawTab, leagueId: selectedLeagueId, divisionId: selectedDivisionId, seasonId: selectedSeasonId } = await searchParams
  const tab = rawTab ?? 'leagues'

  const [ruleSets, leagues, seasons, divisions, teams, tournaments] = await Promise.all([
    prisma.ruleSet.findMany({
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { leagues: true } },
        spirallingExpenseTiers: { orderBy: { teamValueThreshold: 'asc' } },
      },
    }),
    prisma.league.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count:  { select: { teams: true } },
        ruleSet: { select: { id: true, name: true, gameType: true } },
      },
    }),
    prisma.season.findMany({
      orderBy: [{ leagueId: 'asc' }, { season: 'asc' }],
      include: {
        league: { select: { name: true } },
        _count:  { select: { divisions: true } },
      },
    }),
    prisma.division.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        season: { select: { name: true, status: true, league: { select: { name: true } } } },
        teams:  { select: { id: true, name: true, race: { select: { name: true } } }, orderBy: { name: 'asc' } },
      },
    }),
    prisma.team.findMany({
      where:   { divisionId: null },
      orderBy: { name: 'asc' },
      include: { race: { select: { name: true } } },
    }),
    prisma.tournament.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        divisions: {
          include:  { season: { select: { name: true, league: { select: { name: true } } } } },
          orderBy:  { name: 'asc' },
        },
      },
    }),
  ])

  const coaches = isAdmin
    ? await prisma.coach.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { teams: true } } } })
    : []

  // Matches tab — only fetch when needed
  let leagueMatches: Awaited<ReturnType<typeof getMatchesByLeague>> = []
  let leagueTeams: { id: string; name: string; divisionId: string | null; division: { id: string; name: string } | null }[] = []

  if (tab === 'matches' && selectedLeagueId) {
    ;[leagueMatches, leagueTeams] = await Promise.all([
      getMatchesByLeague(selectedLeagueId),
      prisma.team.findMany({
        where:   { leagueId: selectedLeagueId },
        select:  { id: true, name: true, divisionId: true, division: { select: { id: true, name: true } } },
        orderBy: { name: 'asc' },
      }),
    ])
  }

  const openSeasons    = seasons.filter((s) => s.status !== 'ENDED')  // for Divisions create form
  const matchLeagues   = leagues  // all leagues available for matches tab
  const activeRuleSets = ruleSets.filter((r) => r.status === 'ACTIVE')

  // Derived for matches tab
  const leagueDivisions = Array.from(
    new Map(
      leagueTeams.filter((t) => t.division).map((t) => [t.division!.id, t.division!])
    ).values()
  )

  const leagueDivisionIds = new Set(leagueDivisions.map((d) => d.id))
  const leagueTournaments = tournaments
    .filter((t) => t.divisions.some((d) => leagueDivisionIds.has(d.id)))
    .map((t) => ({ id: t.id, name: t.name, divisionIds: t.divisions.map((d) => d.id) }))

  // Seasons for the selected league (for the matches tab season picker)
  const leagueSeasons = selectedLeagueId
    ? seasons.filter((s) => s.leagueId === selectedLeagueId)
    : []

  // Serialize matches for the client component (Date → ISO string)
  const serializedMatches = leagueMatches.map((m) => ({
    id:                   m.id,
    round:                m.round,
    homeTeamId:           m.homeTeam.id,
    homeTeamName:         m.homeTeam.name,
    homeTeamDivisionId:   m.homeTeam.divisionId,
    awayTeamId:           m.awayTeam.id,
    awayTeamName:         m.awayTeam.name,
    awayTeamDivisionId:   m.awayTeam.divisionId,
    scheduledAt:          m.scheduledAt?.toISOString() ?? null,
    status:               m.status,
    homeScore:            m.homeScore,
    awayScore:            m.awayScore,
  }))

  const tabItems = [
    { value: 'leagues', label: 'Leagues & Seasons' },
    { value: 'matches', label: 'Matches & Schedule' },
    ...(isAdmin ? [{ value: 'users', label: 'Users' }] : []),
  ]

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-10">

        {/* Page header + tab navigation */}
        <div>
          <h1 className="font-heading text-3xl font-black text-bb-gold tracking-widest uppercase mb-1">
            League Management
          </h1>
          <p className="text-bb-muted text-sm mb-6">Manage rule sets, leagues, seasons, divisions, matches and team assignments.</p>

          <nav className="flex flex-wrap gap-1.5">
            {tabItems.map(({ value, label }) => (
              <Link
                key={value}
                href={`/league-management?tab=${value}`}
                className={`text-xs font-medium uppercase tracking-widest px-4 py-2 rounded-sm border transition-colors ${
                  tab === value
                    ? 'border-bb-gold text-bb-gold bg-bb-gold/5'
                    : 'border-bb-border text-bb-muted hover:text-white hover:border-bb-muted'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>

        {/* ── Tab 1: Leagues & Seasons ── */}
        {tab === 'leagues' && (
          <>
            {/* Rule Sets */}
            <section>
              <SectionHeading title="Rule Sets" />

              <form action={createRuleSet} className="space-y-2 mb-6">
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-2">
                  <input name="name" required placeholder="Rule set name" className={inputCls()} />
                  <input name="startIncome" type="number" required min={0} step={1000} defaultValue={1000000} placeholder="Start income" className={inputCls('w-36')} />
                  <input name="numberOfPlayers" type="number" required min={1} max={99} defaultValue={16} placeholder="Max players" className={inputCls('w-28')} />
                  <select name="gameType" required className={inputCls('w-44')}>
                    <option value="BLOOD_BOWL">Blood Bowl</option>
                    <option value="DUNGEON_BOWL">Dungeon Bowl</option>
                    <option value="BB7">BB7</option>
                  </select>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs font-heading tracking-widest uppercase text-bb-muted/60">Points per result</span>
                  <label className="flex items-center gap-1.5">
                    <span className="text-xs text-bb-muted">Win</span>
                    <input name="pointsWin" type="number" required min={0} defaultValue={3} className={inputCls('w-16 text-center')} />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-xs text-bb-muted">Draw</span>
                    <input name="pointsDraw" type="number" required min={0} defaultValue={1} className={inputCls('w-16 text-center')} />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-xs text-bb-muted">Loss</span>
                    <input name="pointsLoss" type="number" required min={0} defaultValue={0} className={inputCls('w-16 text-center')} />
                  </label>
                  <button type="submit" className={btnCls('primary', 'ml-auto')}>Create</button>
                </div>
              </form>

              <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
                {ruleSets.length === 0 && (
                  <p className="text-bb-muted/50 text-sm italic px-4 py-3">No rule sets yet.</p>
                )}
                {ruleSets.map((rs) => {
                  const leagueCount = rs._count.leagues
                  return (
                    <details key={rs.id} className="group bg-bb-dark">
                      <summary className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                        <Chevron cls="text-bb-muted/60" />
                        <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{rs.name}</span>
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          <Badge label={GAME_TYPE_LABELS[rs.gameType]} cls={GAME_TYPE_BADGE_CLS[rs.gameType]} />
                          <span className="text-bb-muted text-xs whitespace-nowrap">
                            {rs.startIncome.toLocaleString()} gp · {rs.numberOfPlayers}p · W{rs.pointsWin}/D{rs.pointsDraw}/L{rs.pointsLoss} · {rs.spirallingExpenseTiers.length} SE tier{rs.spirallingExpenseTiers.length !== 1 ? 's' : ''}
                          </span>
                          {rs.status === 'ACTIVE' ? (
                            <Badge label="Active"   cls="border-green-700/50 text-green-400 bg-green-900/10" />
                          ) : (
                            <Badge label="Inactive" cls="border-bb-muted/30 text-bb-muted/50 bg-bb-muted/5" />
                          )}
                        </div>
                      </summary>

                      <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-2 bg-bb-darker/30">
                        <form action={updateRuleSet} className="space-y-1.5">
                          <input type="hidden" name="id" value={rs.id} />
                          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto] gap-1.5">
                            <input name="name" defaultValue={rs.name} required className={inputCls()} />
                            <input name="startIncome" type="number" required min={0} step={1000} defaultValue={rs.startIncome} className={inputCls('w-36')} />
                            <input name="numberOfPlayers" type="number" required min={1} max={99} defaultValue={rs.numberOfPlayers} className={inputCls('w-28')} />
                            <select name="gameType" defaultValue={rs.gameType} className={inputCls('w-44')}>
                              <option value="BLOOD_BOWL">Blood Bowl</option>
                              <option value="DUNGEON_BOWL">Dungeon Bowl</option>
                              <option value="BB7">BB7</option>
                            </select>
                          </div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-xs font-heading tracking-widest uppercase text-bb-muted/60">Points per result</span>
                            <label className="flex items-center gap-1.5">
                              <span className="text-xs text-bb-muted">Win</span>
                              <input name="pointsWin" type="number" required min={0} defaultValue={rs.pointsWin} className={inputCls('w-16 text-center')} />
                            </label>
                            <label className="flex items-center gap-1.5">
                              <span className="text-xs text-bb-muted">Draw</span>
                              <input name="pointsDraw" type="number" required min={0} defaultValue={rs.pointsDraw} className={inputCls('w-16 text-center')} />
                            </label>
                            <label className="flex items-center gap-1.5">
                              <span className="text-xs text-bb-muted">Loss</span>
                              <input name="pointsLoss" type="number" required min={0} defaultValue={rs.pointsLoss} className={inputCls('w-16 text-center')} />
                            </label>
                            <button type="submit" className={btnCls('ghost', 'ml-auto')}>Save</button>
                          </div>
                        </form>

                        <div className="flex gap-2 pt-1 border-t border-bb-border/30">
                          <form action={toggleRuleSetStatus}>
                            <input type="hidden" name="id" value={rs.id} />
                            <button type="submit" className={btnCls('ghost')}>
                              {rs.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                            </button>
                          </form>
                          <form action={deleteRuleSet}>
                            <input type="hidden" name="id" value={rs.id} />
                            <button
                              type="submit"
                              disabled={leagueCount > 0}
                              title={leagueCount > 0 ? `Used by ${leagueCount} league(s) — reassign first` : 'Delete rule set'}
                              className={btnCls(leagueCount > 0 ? 'muted' : 'danger')}
                            >
                              Delete
                            </button>
                          </form>
                        </div>

                        <div className="border-t border-bb-border/40 pt-3 space-y-1.5">
                          <div className="flex items-center justify-between">
                            <p className="text-bb-muted text-xs uppercase tracking-widest">Spiralling Expenses</p>
                            <form action={importDefaultSpirallingExpenseTiers}>
                              <input type="hidden" name="ruleSetId" value={rs.id} />
                              <button type="submit" className={btnCls('ghost')} title="Fill in any missing CRP1 standard tiers (1,750k+, +10,000gp every +150,000 TV)">
                                Import CRP1 Defaults
                              </button>
                            </form>
                          </div>
                          {rs.spirallingExpenseTiers.length === 0 && (
                            <p className="text-bb-muted/40 text-xs italic">No tiers configured — Spiralling Expenses disabled for this rule set.</p>
                          )}
                          {rs.spirallingExpenseTiers.map((tier) => (
                            <div key={tier.id} className="flex items-center justify-between text-sm">
                              <span className="text-white">
                                {tier.teamValueThreshold.toLocaleString()}k TV &rarr; {tier.expenseAmount.toLocaleString()} gp
                              </span>
                              <form action={removeSpirallingExpenseTier}>
                                <input type="hidden" name="id" value={tier.id} />
                                <button type="submit" className={btnCls('danger')}>Remove</button>
                              </form>
                            </div>
                          ))}
                          <form action={addSpirallingExpenseTier} className="flex items-center gap-2 pt-1">
                            <input type="hidden" name="ruleSetId" value={rs.id} />
                            <input name="teamValueThreshold" type="number" min={0} step={10} required placeholder="TV (k)" className={inputCls('w-24')} />
                            <span className="text-bb-muted text-xs whitespace-nowrap">k TV &rarr;</span>
                            <input name="expenseAmount" type="number" min={0} step={1000} required placeholder="Expense (gp)" className={inputCls('w-32')} />
                            <button type="submit" className={btnCls('ghost')}>Add Tier</button>
                          </form>
                        </div>
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>

            {/* Leagues */}
            <section>
              <SectionHeading title="Leagues" />

              <details className="group mb-6 bg-bb-dark border border-bb-border rounded-sm">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                  <Chevron cls="text-bb-muted" />
                  <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Create new league</span>
                </summary>
                <form action={createLeague} className="px-4 pb-4 pt-3 border-t border-bb-border/40 flex gap-2">
                  <input name="name" required placeholder="League name" className={inputCls('flex-1')} />
                  <button type="submit" className={btnCls('primary')}>Create</button>
                </form>
              </details>

              <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
                {leagues.length === 0 && (
                  <p className="text-bb-muted/50 text-sm italic px-4 py-3">No leagues yet.</p>
                )}
                {leagues.map((league) => {
                  const hasTeams = league._count.teams > 0
                  return (
                    <details key={league.id} className="group bg-bb-dark">
                      <summary className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                        <Chevron cls="text-bb-muted/60" />
                        <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{league.name}</span>
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          {league.ruleSet && (
                            <Badge
                              label={`${league.ruleSet.name} · ${GAME_TYPE_LABELS[league.ruleSet.gameType]}`}
                              cls={GAME_TYPE_BADGE_CLS[league.ruleSet.gameType]}
                            />
                          )}
                          <span className="text-bb-muted/40 text-xs whitespace-nowrap">
                            {league._count.teams} team{league._count.teams !== 1 ? 's' : ''}
                          </span>
                          {league.isHidden && <HiddenBadge />}
                        </div>
                      </summary>

                      <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-2 bg-bb-darker/30">
                        <form action={renameLeague} className="flex gap-1.5">
                          <input type="hidden" name="id" value={league.id} />
                          <input name="name" defaultValue={league.name} required className={inputCls('flex-1')} />
                          <button type="submit" className={btnCls('ghost')}>Rename</button>
                        </form>
                        <form action={setLeagueRuleSet} className="flex gap-2 items-center">
                          <input type="hidden" name="id" value={league.id} />
                          <select name="ruleSetId" defaultValue={league.ruleSetId ?? ''} className={inputCls('flex-1 text-xs')}>
                            <option value="">— No rule set —</option>
                            {activeRuleSets.map((rs) => (
                              <option key={rs.id} value={rs.id}>{rs.name} · {GAME_TYPE_LABELS[rs.gameType]}</option>
                            ))}
                            {league.ruleSet && !activeRuleSets.find((r) => r.id === league.ruleSet!.id) && (
                              <option value={league.ruleSet.id}>
                                {league.ruleSet.name} · {GAME_TYPE_LABELS[league.ruleSet.gameType]} (inactive)
                              </option>
                            )}
                          </select>
                          <button type="submit" className={btnCls('ghost')}>Set Rule Set</button>
                        </form>
                        <div className="flex gap-2 pt-1 border-t border-bb-border/30">
                          <form action={toggleLeagueVisibility}>
                            <input type="hidden" name="id" value={league.id} />
                            <button type="submit" className={btnCls('ghost')}>{league.isHidden ? 'Show' : 'Hide'}</button>
                          </form>
                          <form action={deleteLeague}>
                            <input type="hidden" name="id" value={league.id} />
                            <button
                              type="submit"
                              disabled={hasTeams}
                              title={hasTeams ? 'Move or remove all teams first' : 'Delete league'}
                              className={btnCls(hasTeams ? 'muted' : 'danger')}
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>

            {/* Seasons */}
            <section>
              <SectionHeading title="Seasons" />

              <details className="group mb-6 bg-bb-dark border border-bb-border rounded-sm">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                  <Chevron cls="text-bb-muted" />
                  <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Create new season</span>
                </summary>
                <form action={createSeason} className="px-4 pb-4 pt-3 border-t border-bb-border/40 flex gap-2">
                  <select name="leagueId" required className={inputCls('w-44')}>
                    <option value="">— Select league —</option>
                    {leagues.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <input name="name" required placeholder="Season name" className={inputCls('flex-1')} />
                  <input name="season" type="number" required min={1} defaultValue={1} placeholder="#" className={inputCls('w-16 text-center')} />
                  <button type="submit" className={btnCls('primary')}>Create</button>
                </form>
              </details>

              <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
                {seasons.length === 0 && (
                  <p className="text-bb-muted/50 text-sm italic px-4 py-3">No seasons yet.</p>
                )}
                {seasons.map((season) => {
                  const divCount = season._count.divisions
                  return (
                    <details key={season.id} className="group bg-bb-dark">
                      <summary className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                        <Chevron cls="text-bb-muted/60" />
                        <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{season.name}</span>
                        <Badge label={season.league.name} cls="border-bb-gold/30 text-bb-gold/70 bg-bb-gold/5 hidden sm:inline" />
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          <Badge label={SEASON_STATUS_LABELS[season.status]} cls={SEASON_STATUS_BADGE_CLS[season.status]} />
                          <span className="text-bb-muted/40 text-xs whitespace-nowrap">
                            {divCount} division{divCount !== 1 ? 's' : ''}
                          </span>
                        </div>
                      </summary>

                      <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-2 bg-bb-darker/30">
                        <form action={renameSeason} className="flex gap-1.5">
                          <input type="hidden" name="id" value={season.id} />
                          <input name="name" defaultValue={season.name} required className={inputCls('flex-1')} />
                          <button type="submit" className={btnCls('ghost')}>Rename</button>
                        </form>
                        <form action={setSeasonStatus} className="flex gap-2 items-center">
                          <input type="hidden" name="id" value={season.id} />
                          <select name="status" defaultValue={season.status} className={inputCls('flex-1 text-xs')}>
                            <option value="PLANNING">Planning</option>
                            <option value="READY">Ready for first gameday</option>
                            <option value="ACTIVE">Season started</option>
                            <option value="ENDED">Season ended</option>
                          </select>
                          <button type="submit" className={btnCls('ghost')}>Set Status</button>
                        </form>
                        <div className="flex gap-2 pt-1 border-t border-bb-border/30">
                          <form action={deleteSeason}>
                            <input type="hidden" name="id" value={season.id} />
                            <button
                              type="submit"
                              disabled={divCount > 0}
                              title={divCount > 0 ? 'Remove all divisions first' : 'Delete season'}
                              className={btnCls(divCount > 0 ? 'muted' : 'danger')}
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>

            {/* Divisions */}
            <section>
              <SectionHeading title="Divisions" />

              <details className="group mb-6 bg-bb-dark border border-bb-border rounded-sm">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                  <Chevron cls="text-bb-muted" />
                  <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Create new division</span>
                </summary>
                <form action={createDivision} className="px-4 pb-4 pt-3 border-t border-bb-border/40 flex gap-2">
                  <input name="name" required placeholder="Division name" className={inputCls('flex-1')} />
                  <select name="seasonId" required className={inputCls('w-52')}>
                    <option value="">— Select season —</option>
                    {openSeasons.map((s) => (
                      <option key={s.id} value={s.id}>{s.league.name} · {s.name}</option>
                    ))}
                  </select>
                  <button type="submit" className={btnCls('primary')}>Create</button>
                </form>
              </details>

              <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
                {divisions.length === 0 && (
                  <p className="text-bb-muted/50 text-sm italic px-4 py-3">No divisions yet.</p>
                )}
                {divisions.map((div) => {
                  const hasTeams = div.teams.length > 0
                  const isLocked = div.season.status === 'ENDED'
                  return (
                    <details key={div.id} className="group bg-bb-dark">
                      <summary className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                        <Chevron cls="text-bb-muted/60" />
                        <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{div.name}</span>
                        <Badge label={`${div.season.league.name} · ${div.season.name}`} cls="border-bb-gold/30 text-bb-gold bg-bb-gold/5 hidden sm:inline" />
                        <div className="flex items-center gap-1.5 ml-auto shrink-0">
                          <span className="text-bb-muted/40 text-xs whitespace-nowrap">
                            {div.teams.length} team{div.teams.length !== 1 ? 's' : ''}
                          </span>
                          {div.isHidden && <HiddenBadge />}
                          {isLocked && <Badge label="Locked" cls="border-bb-crimson/40 text-bb-crimson-bright bg-bb-crimson/5" />}
                        </div>
                      </summary>

                      <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3 bg-bb-darker/30">
                        {isLocked ? (
                          <p className="text-bb-muted/50 text-xs italic">Season ended — this division is locked.</p>
                        ) : (
                          <div className="space-y-2">
                            <form action={renameDivision} className="flex gap-1.5">
                              <input type="hidden" name="id" value={div.id} />
                              <input name="name" defaultValue={div.name} required className={inputCls('flex-1')} />
                              <button type="submit" className={btnCls('ghost')}>Rename</button>
                            </form>
                            <div className="flex gap-2 pt-1 border-t border-bb-border/30">
                              <form action={toggleDivisionVisibility}>
                                <input type="hidden" name="id" value={div.id} />
                                <button type="submit" className={btnCls('ghost')}>{div.isHidden ? 'Show' : 'Hide'}</button>
                              </form>
                              <form action={deleteDivision}>
                                <input type="hidden" name="id" value={div.id} />
                                <button
                                  type="submit"
                                  disabled={hasTeams}
                                  title={hasTeams ? 'Remove all teams from division first' : 'Delete division'}
                                  className={btnCls(hasTeams ? 'muted' : 'danger')}
                                >
                                  Delete
                                </button>
                              </form>
                            </div>
                          </div>
                        )}

                        <div className="border-t border-bb-border/40 pt-3 space-y-2">
                          <p className="text-bb-muted text-xs uppercase tracking-widest">Teams in division</p>
                          {div.teams.length === 0 && (
                            <p className="text-bb-muted/40 text-xs italic">No teams assigned.</p>
                          )}
                          {div.teams.map((team) => (
                            <div key={team.id} className="flex items-center justify-between">
                              <span className="text-sm text-white">
                                {team.name}
                                <span className="text-bb-muted text-xs ml-2">({team.race.name})</span>
                              </span>
                              {!isLocked && (
                                <form action={removeTeamFromDivision}>
                                  <input type="hidden" name="teamId" value={team.id} />
                                  <button type="submit" className={btnCls('danger')}>Remove</button>
                                </form>
                              )}
                            </div>
                          ))}
                          {!isLocked && teams.length > 0 && (
                            <form action={assignTeamToDivision} className="flex gap-2 pt-1">
                              <input type="hidden" name="divisionId" value={div.id} />
                              <select name="teamId" required className={inputCls('flex-1 text-xs')}>
                                <option value="">— Add a team —</option>
                                {teams.map((t) => (
                                  <option key={t.id} value={t.id}>{t.name} ({t.race.name})</option>
                                ))}
                              </select>
                              <button type="submit" className={btnCls('ghost')}>Add</button>
                            </form>
                          )}
                          {!isLocked && teams.length === 0 && div.teams.length === 0 && (
                            <p className="text-bb-muted/30 text-xs italic">No unassigned teams available.</p>
                          )}
                        </div>
                      </div>
                    </details>
                  )
                })}
              </div>
            </section>

            {/* Tournaments */}
            <section>
              <SectionHeading title="Tournaments" />

              <details className="group mb-6 bg-bb-dark border border-bb-border rounded-sm">
                <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                  <Chevron cls="text-bb-muted" />
                  <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Create new tournament</span>
                </summary>
                <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-2">
                  <form action={createTournament} className="space-y-2">
                    <div className="flex gap-2">
                      <input name="name" required placeholder="Tournament name" className={inputCls('flex-1')} />
                      <select name="divisionId" required className={inputCls('w-60')}>
                        <option value="">— Select division —</option>
                        {divisions.map((d) => (
                          <option key={d.id} value={d.id}>{d.name} ({d.season.league.name} · {d.season.name})</option>
                        ))}
                      </select>
                      <button type="submit" className={btnCls('primary')}>Create</button>
                    </div>
                    <label className="flex items-center gap-2 text-xs text-bb-muted cursor-pointer select-none">
                      <input type="checkbox" name="crossDivision" value="1" className="accent-bb-gold" />
                      Cross-division — can span multiple divisions
                    </label>
                  </form>
                </div>
              </details>

              <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
                {tournaments.length === 0 && (
                  <p className="text-bb-muted/50 text-sm italic px-4 py-3">No tournaments yet.</p>
                )}
                {tournaments.map((t) => (
                  <details key={t.id} className="group bg-bb-dark">
                    <summary className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                      <Chevron cls="text-bb-muted/60" />
                      <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{t.name}</span>
                      <div className="flex items-center gap-1.5 ml-auto shrink-0">
                        {t.crossDivision && (
                          <Badge label="Cross-division" cls="border-blue-700/50 text-blue-400 bg-blue-900/10" />
                        )}
                        <span className="text-bb-muted/40 text-xs whitespace-nowrap">
                          {t.divisions.length} division{t.divisions.length !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </summary>

                    <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3 bg-bb-darker/30">
                      <form action={renameTournament} className="flex gap-1.5">
                        <input type="hidden" name="id" value={t.id} />
                        <input name="name" defaultValue={t.name} required className={inputCls('flex-1')} />
                        <button type="submit" className={btnCls('ghost')}>Rename</button>
                      </form>

                      <div className="flex gap-2 pt-1 border-t border-bb-border/30">
                        <form action={toggleTournamentCrossDiv}>
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className={btnCls('ghost')}>
                            {t.crossDivision ? 'Make single-division' : 'Make cross-division'}
                          </button>
                        </form>
                        <form action={deleteTournament} className="ml-auto">
                          <input type="hidden" name="id" value={t.id} />
                          <button type="submit" className={btnCls('danger')}>Delete</button>
                        </form>
                      </div>

                      <div className="border-t border-bb-border/40 pt-3 space-y-2">
                        <p className="text-bb-muted text-xs uppercase tracking-widest">Divisions</p>
                        {t.divisions.length === 0 && (
                          <p className="text-bb-muted/40 text-xs italic">No divisions linked.</p>
                        )}
                        {t.divisions.map((d) => {
                          const canRemove = t.divisions.length > 1
                          return (
                            <div key={d.id} className="flex items-center justify-between">
                              <span className="text-sm text-white">
                                {d.name}
                                <span className="text-bb-muted text-xs ml-2">({d.season.league.name} · {d.season.name})</span>
                              </span>
                              <form action={removeDivisionFromTournament}>
                                <input type="hidden" name="tournamentId" value={t.id} />
                                <input type="hidden" name="divisionId" value={d.id} />
                                <button
                                  type="submit"
                                  disabled={!canRemove}
                                  title={!canRemove ? 'Cannot remove the last division' : 'Remove division'}
                                  className={btnCls(!canRemove ? 'muted' : 'danger')}
                                >
                                  Remove
                                </button>
                              </form>
                            </div>
                          )
                        })}
                        {(t.crossDivision || t.divisions.length === 0) && (() => {
                          const available = divisions.filter((d) => !t.divisions.some((td) => td.id === d.id))
                          return available.length > 0 ? (
                            <form action={addDivisionToTournament} className="flex gap-2 pt-1">
                              <input type="hidden" name="tournamentId" value={t.id} />
                              <select name="divisionId" required className={inputCls('flex-1 text-xs')}>
                                <option value="">— Add a division —</option>
                                {available.map((d) => (
                                  <option key={d.id} value={d.id}>{d.name} ({d.season.league.name} · {d.season.name})</option>
                                ))}
                              </select>
                              <button type="submit" className={btnCls('ghost')}>Add</button>
                            </form>
                          ) : null
                        })()}
                      </div>
                    </div>
                  </details>
                ))}
              </div>
            </section>
          </>
        )}

        {/* ── Tab 2: Matches & Schedule ── */}
        {tab === 'matches' && (
          <section>
            <SectionHeading title="Matches & Schedule" />
            <MatchesTab
              matchLeagues={matchLeagues}
              selectedLeagueId={selectedLeagueId}
              leagueSeasons={leagueSeasons.map((s) => ({ id: s.id, name: s.name, season: s.season, status: s.status }))}
              selectedSeasonId={selectedSeasonId}
              leagueDivisions={leagueDivisions}
              leagueTeams={leagueTeams.map((t) => ({ id: t.id, name: t.name, divisionId: t.divisionId }))}
              matches={serializedMatches}
              tournaments={leagueTournaments}
            />
          </section>
        )}

        {/* ── Tab 3: Users (admin only) ── */}
        {isAdmin && tab === 'users' && (
          <section>
            <SectionHeading title="Users" />

            <details className="group mb-6 bg-bb-dark border border-bb-border rounded-sm">
              <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                <Chevron cls="text-bb-muted" />
                <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Create new user</span>
              </summary>
              <form action={createCoach} className="px-4 pb-4 pt-3 border-t border-bb-border/40 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input name="name"     required placeholder="Full name"                              className={inputCls()} />
                <input name="email"    required type="email"    placeholder="Email address"          className={inputCls()} />
                <select name="role" required className={inputCls()}>
                  <option value="COACH">Coach</option>
                  <option value="COMMISH">Commish</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <input name="password" required type="password" placeholder="Initial password (min 6 chars)" className={inputCls()} />
                <button type="submit" className={`${btnCls('primary')} sm:col-span-2`}>Create User</button>
              </form>
            </details>

            <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
              {coaches.length === 0 && (
                <p className="text-bb-muted/50 text-sm italic px-4 py-3">No users yet.</p>
              )}
              {coaches.map((coach) => {
                const isSelf    = coach.id === session?.coachId
                const teamCount = coach._count.teams
                const hasTeams  = teamCount > 0
                return (
                  <details key={coach.id} className="group bg-bb-dark">
                    <summary className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                      <Chevron cls="text-bb-muted/60" />
                      <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{coach.name}</span>
                      {coach.alias && <span className="text-bb-gold/60 text-xs hidden sm:block">@{coach.alias}</span>}
                      <span className="text-bb-muted text-xs hidden md:block min-w-0 truncate">{coach.email}</span>
                      <div className="flex items-center gap-1.5 ml-auto shrink-0">
                        <Badge label={coach.role} cls={ROLE_BADGE_CLS[coach.role]} />
                        {coach.isActive
                          ? <Badge label="Active"   cls="border-green-700/50 text-green-400 bg-green-900/10" />
                          : <Badge label="Inactive" cls="border-bb-muted/30 text-bb-muted/50 bg-bb-muted/5" />
                        }
                        <span className="text-bb-muted/40 text-xs whitespace-nowrap">
                          {teamCount} team{teamCount !== 1 ? 's' : ''}
                        </span>
                        {isSelf && <span className="text-bb-muted/30 text-xs italic">(you)</span>}
                      </div>
                    </summary>

                    <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-2 bg-bb-darker/30">
                      <p className="text-bb-muted text-xs hidden md:block mb-3">{coach.email}</p>
                      <form action={renameCoach} className="flex gap-1.5">
                        <input type="hidden" name="id" value={coach.id} />
                        <input name="name" defaultValue={coach.name} required className={inputCls('flex-1')} />
                        <button type="submit" className={btnCls('ghost')}>Rename</button>
                      </form>
                      <form action={setCoachRole} className="flex gap-1.5">
                        <input type="hidden" name="id" value={coach.id} />
                        <select
                          name="role"
                          defaultValue={coach.role}
                          disabled={isSelf}
                          className={inputCls('flex-1 text-xs')}
                        >
                          <option value="COACH">Coach</option>
                          <option value="COMMISH">Commish</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                        <button
                          type="submit"
                          disabled={isSelf}
                          title={isSelf ? 'Cannot change your own role' : undefined}
                          className={btnCls(isSelf ? 'muted' : 'ghost')}
                        >
                          Set Role
                        </button>
                      </form>
                      <form action={updateCoachEmail} className="flex gap-1.5">
                        <input type="hidden" name="id" value={coach.id} />
                        <input name="email" type="email" defaultValue={coach.email} required className={inputCls('flex-1')} />
                        <button type="submit" className={btnCls('ghost')}>Update Email</button>
                      </form>
                      <form action={resetCoachPassword} className="flex gap-1.5">
                        <input type="hidden" name="id" value={coach.id} />
                        <input name="password" type="password" required minLength={6} placeholder="New password (min 6 chars)" className={inputCls('flex-1')} />
                        <button type="submit" className={btnCls('ghost')}>Reset Password</button>
                      </form>
                      <ResetLinkButton coachId={coach.id} btnCls={btnCls} inputCls={inputCls('flex-1')} />
                      {coach.mfaEnabled && (
                        <form action={disableCoachMfa} className="flex gap-1.5">
                          <input type="hidden" name="id" value={coach.id} />
                          <button type="submit" className={btnCls('ghost')}>Disable MFA</button>
                        </form>
                      )}
                      <form action={setCoachPrimaryLeague} className="flex gap-1.5">
                        <input type="hidden" name="id" value={coach.id} />
                        <select name="primaryLeagueId" defaultValue={coach.primaryLeagueId ?? ''} className={inputCls('flex-1')}>
                          <option value="">— No primary league —</option>
                          {leagues.map((l) => (
                            <option key={l.id} value={l.id}>{l.name}</option>
                          ))}
                        </select>
                        <button type="submit" className={btnCls('ghost')}>Set League</button>
                      </form>
                      <div className="flex gap-2 pt-2 border-t border-bb-border/30">
                        <form action={toggleCoachActive}>
                          <input type="hidden" name="id" value={coach.id} />
                          <button
                            type="submit"
                            disabled={isSelf}
                            title={isSelf ? 'Cannot deactivate your own account' : undefined}
                            className={btnCls(isSelf ? 'muted' : 'ghost')}
                          >
                            {coach.isActive ? 'Deactivate' : 'Activate'}
                          </button>
                        </form>
                        <form action={deleteCoach}>
                          <input type="hidden" name="id" value={coach.id} />
                          <button
                            type="submit"
                            disabled={isSelf || hasTeams}
                            title={isSelf ? 'Cannot delete your own account' : hasTeams ? `Remove the ${teamCount} team(s) first` : 'Delete user'}
                            className={btnCls(isSelf || hasTeams ? 'muted' : 'danger')}
                          >
                            Delete
                          </button>
                        </form>
                      </div>
                    </div>
                  </details>
                )
              })}
            </div>
          </section>
        )}

      </div>
    </div>
  )
}
