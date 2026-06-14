import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import {
  createLeague, renameLeague, toggleLeagueVisibility, deleteLeague, setLeagueStatus,
  createDivision, renameDivision, toggleDivisionVisibility, deleteDivision,
  assignTeamToDivision, removeTeamFromDivision,
} from './actions'
import {
  createRuleSet, updateRuleSet, toggleRuleSetStatus, deleteRuleSet, setLeagueRuleSet,
} from './ruleset-actions'
import {
  createCoach, renameCoach, updateCoachEmail, resetCoachPassword,
  toggleCoachActive, deleteCoach,
} from './coach-actions'

export const dynamic = 'force-dynamic'

// ── Display maps ─────────────────────────────────────────────────────────────

const STATUS_LABELS: Record<string, string> = {
  READY:  'Ready for first gameday',
  ACTIVE: 'Season started',
  ENDED:  'Season ended',
}
const STATUS_BADGE_CLS: Record<string, string> = {
  READY:  'border-green-700/50 text-green-400 bg-green-900/10',
  ACTIVE: 'border-bb-gold/40 text-bb-gold bg-bb-gold/5',
  ENDED:  'border-bb-crimson/50 text-bb-crimson-bright bg-bb-crimson/5',
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

export default async function LeagueManagementPage() {
  const session = await getSession()
  const isAdmin = session?.role === 'ADMIN'

  const [ruleSets, leagues, divisions, teams] = await Promise.all([
    prisma.ruleSet.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { leagues: true } } },
    }),
    prisma.league.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        _count:  { select: { teams: true } },
        ruleSet: { select: { id: true, name: true, gameType: true } },
      },
    }),
    prisma.division.findMany({
      orderBy: { createdAt: 'asc' },
      include: {
        league: { select: { name: true, status: true } },
        teams:  { select: { id: true, name: true, race: { select: { name: true } } }, orderBy: { name: 'asc' } },
      },
    }),
    prisma.team.findMany({
      where:   { divisionId: null },
      orderBy: { name: 'asc' },
      include: { race: { select: { name: true } } },
    }),
  ])

  const coaches = isAdmin
    ? await prisma.coach.findMany({ orderBy: { name: 'asc' }, include: { _count: { select: { teams: true } } } })
    : []

  const activeLeagues  = leagues.filter((l) => l.status !== 'ENDED')
  const activeRuleSets = ruleSets.filter((r) => r.status === 'ACTIVE')

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-14">

        <div>
          <h1 className="font-heading text-3xl font-black text-bb-gold tracking-widest uppercase mb-1">
            League Management
          </h1>
          <p className="text-bb-muted text-sm">Manage rule sets, leagues, divisions, and team assignments.</p>
        </div>

        {/* ── Rule Sets ── */}
        <section>
          <SectionHeading title="Rule Sets" />

          {/* Create rule set */}
          <form action={createRuleSet} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-2 mb-6">
            <input name="name" required placeholder="Rule set name" className={inputCls()} />
            <input name="startIncome" type="number" required min={0} step={1000} defaultValue={1000000} placeholder="Start income" className={inputCls('w-36')} />
            <input name="numberOfPlayers" type="number" required min={1} max={99} defaultValue={16} placeholder="Max players" className={inputCls('w-28')} />
            <select name="gameType" required className={inputCls('w-44')}>
              <option value="BLOOD_BOWL">Blood Bowl</option>
              <option value="DUNGEON_BOWL">Dungeon Bowl</option>
              <option value="BB7">BB7</option>
            </select>
            <button type="submit" className={btnCls('primary')}>Create</button>
          </form>

          {/* Rule set list */}
          <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
            {ruleSets.length === 0 && (
              <p className="text-bb-muted/50 text-sm italic px-4 py-3">No rule sets yet.</p>
            )}
            {ruleSets.map((rs) => {
              const leagueCount = rs._count.leagues
              return (
                <details key={rs.id} className="group bg-bb-dark">
                  {/* Compact row */}
                  <summary className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                    <Chevron cls="text-bb-muted/60" />
                    <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{rs.name}</span>
                    <div className="flex items-center gap-1.5 ml-auto shrink-0">
                      <Badge label={GAME_TYPE_LABELS[rs.gameType]} cls={GAME_TYPE_BADGE_CLS[rs.gameType]} />
                      <span className="text-bb-muted text-xs whitespace-nowrap">
                        {rs.startIncome.toLocaleString()} gp · {rs.numberOfPlayers}p
                      </span>
                      {rs.status === 'ACTIVE' ? (
                        <Badge label="Active"   cls="border-green-700/50 text-green-400 bg-green-900/10" />
                      ) : (
                        <Badge label="Inactive" cls="border-bb-muted/30 text-bb-muted/50 bg-bb-muted/5" />
                      )}
                    </div>
                  </summary>

                  {/* Edit panel */}
                  <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-2 bg-bb-darker/30">
                    <form action={updateRuleSet} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto_auto_auto] gap-1.5">
                      <input type="hidden" name="id" value={rs.id} />
                      <input name="name" defaultValue={rs.name} required className={inputCls()} />
                      <input name="startIncome" type="number" required min={0} step={1000} defaultValue={rs.startIncome} className={inputCls('w-36')} />
                      <input name="numberOfPlayers" type="number" required min={1} max={99} defaultValue={rs.numberOfPlayers} className={inputCls('w-28')} />
                      <select name="gameType" defaultValue={rs.gameType} className={inputCls('w-44')}>
                        <option value="BLOOD_BOWL">Blood Bowl</option>
                        <option value="DUNGEON_BOWL">Dungeon Bowl</option>
                        <option value="BB7">BB7</option>
                      </select>
                      <button type="submit" className={btnCls('ghost')}>Save</button>
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
                  </div>
                </details>
              )
            })}
          </div>
        </section>

        {/* ── Leagues ── */}
        <section>
          <SectionHeading title="Leagues" />

          <form action={createLeague} className="flex gap-2 mb-6">
            <input name="name" required placeholder="League name" className={inputCls('flex-1')} />
            <input name="season" type="number" required min={1} defaultValue={1} placeholder="Season" className={inputCls('w-24')} />
            <button type="submit" className={btnCls('primary')}>Create</button>
          </form>

          <div className="space-y-3">
            {leagues.length === 0 && (
              <p className="text-bb-muted/50 text-sm italic">No leagues yet.</p>
            )}
            {leagues.map((league) => {
              const hasTeams = league._count.teams > 0
              return (
                <div key={league.id} className="bg-bb-dark border border-bb-border rounded-sm p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-heading font-bold text-white text-sm">{league.name}</span>
                    <span className="text-bb-muted text-xs">Season {league.season}</span>
                    <span className="text-bb-muted/50 text-xs">{league._count.teams} team{league._count.teams !== 1 ? 's' : ''}</span>
                    <Badge label={STATUS_LABELS[league.status]} cls={STATUS_BADGE_CLS[league.status]} />
                    {league.ruleSet && (
                      <Badge
                        label={`${league.ruleSet.name} · ${GAME_TYPE_LABELS[league.ruleSet.gameType]}`}
                        cls={GAME_TYPE_BADGE_CLS[league.ruleSet.gameType]}
                      />
                    )}
                    {league.isHidden && <HiddenBadge />}
                  </div>

                  {/* Rename / Hide / Delete */}
                  <div className="flex gap-2 flex-wrap items-center">
                    <form action={renameLeague} className="flex gap-1.5">
                      <input type="hidden" name="id" value={league.id} />
                      <input name="name" defaultValue={league.name} required className={inputCls('w-44')} />
                      <button type="submit" className={btnCls('ghost')}>Rename</button>
                    </form>
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

                  {/* Status */}
                  <form action={setLeagueStatus} className="flex gap-2 items-center">
                    <input type="hidden" name="id" value={league.id} />
                    <select name="status" defaultValue={league.status} className={inputCls('text-xs')}>
                      <option value="READY">Ready for first gameday</option>
                      <option value="ACTIVE">Season started</option>
                      <option value="ENDED">Season ended</option>
                    </select>
                    <button type="submit" className={btnCls('ghost')}>Set status</button>
                  </form>

                  {/* Rule set */}
                  <form action={setLeagueRuleSet} className="flex gap-2 items-center">
                    <input type="hidden" name="id" value={league.id} />
                    <select name="ruleSetId" defaultValue={league.ruleSetId ?? ''} className={inputCls('text-xs flex-1')}>
                      <option value="">— No rule set —</option>
                      {activeRuleSets.map((rs) => (
                        <option key={rs.id} value={rs.id}>
                          {rs.name} · {GAME_TYPE_LABELS[rs.gameType]}
                        </option>
                      ))}
                      {/* Keep current assignment visible even if it became inactive */}
                      {league.ruleSet && !activeRuleSets.find((r) => r.id === league.ruleSet!.id) && (
                        <option value={league.ruleSet.id}>
                          {league.ruleSet.name} · {GAME_TYPE_LABELS[league.ruleSet.gameType]} (inactive)
                        </option>
                      )}
                    </select>
                    <button type="submit" className={btnCls('ghost')}>Set rule set</button>
                  </form>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── Divisions ── */}
        <section>
          <SectionHeading title="Divisions" />

          <form action={createDivision} className="flex gap-2 mb-6">
            <input name="name" required placeholder="Division name" className={inputCls('flex-1')} />
            <select name="leagueId" required className={inputCls('w-48')}>
              <option value="">— Select league —</option>
              {activeLeagues.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
            <button type="submit" className={btnCls('primary')}>Create</button>
          </form>

          <div className="space-y-4">
            {divisions.length === 0 && (
              <p className="text-bb-muted/50 text-sm italic">No divisions yet.</p>
            )}
            {divisions.map((div) => {
              const hasTeams = div.teams.length > 0
              const isLocked = div.league.status === 'ENDED'
              return (
                <div key={div.id} className="bg-bb-dark border border-bb-border rounded-sm p-4 space-y-4">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="font-heading font-bold text-white text-sm">{div.name}</span>
                    <Badge label={div.league.name} cls="border-bb-gold/30 text-bb-gold bg-bb-gold/5" />
                    {div.isHidden && <HiddenBadge />}
                    {isLocked && <Badge label="Locked" cls="border-bb-crimson/40 text-bb-crimson-bright bg-bb-crimson/5" />}
                  </div>

                  {isLocked ? (
                    <p className="text-bb-muted/50 text-xs italic">Season ended — this division is locked.</p>
                  ) : (
                    <div className="flex gap-2 flex-wrap items-center">
                      <form action={renameDivision} className="flex gap-1.5">
                        <input type="hidden" name="id" value={div.id} />
                        <input name="name" defaultValue={div.name} required className={inputCls('w-44')} />
                        <button type="submit" className={btnCls('ghost')}>Rename</button>
                      </form>
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
                  )}

                  <div className="border-t border-bb-border/50 pt-3 space-y-2">
                    <p className="text-bb-muted text-xs uppercase tracking-widest mb-2">Teams in division</p>
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
              )
            })}
          </div>
        </section>

        {/* ── Users (admin only) ── */}
        {isAdmin && (
          <section>
            <SectionHeading title="Users" />

            {/* Create user */}
            <details className="group mb-6 bg-bb-dark border border-bb-border rounded-sm">
              <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
                <Chevron cls="text-bb-muted" />
                <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Create new user</span>
              </summary>
              <form action={createCoach} className="px-4 pb-4 pt-3 border-t border-bb-border/40 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <input name="name"     required placeholder="Full name"                     className={inputCls()} />
                <input name="email"    required type="email"    placeholder="Email address"  className={inputCls()} />
                <select name="role" required className={inputCls()}>
                  <option value="COACH">Coach</option>
                  <option value="COMMISH">Commish</option>
                  <option value="ADMIN">Admin</option>
                </select>
                <input name="password" required type="password" placeholder="Initial password (min 6 chars)" className={inputCls()} />
                <button type="submit" className={`${btnCls('primary')} sm:col-span-2`}>Create User</button>
              </form>
            </details>

            {/* User list */}
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
