import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getTeamById, getPendingJourneymen, getTeamCompletedMatches } from '@/lib/queries/teams'
import { getSession } from '@/lib/auth'
import { updatePlayer, updateTeamInfo, deleteTeam, deactivateTeam, activateTeam, assignTeam,
         buyPlayer, sackPlayer, reinstatePlayer, appendTeamNewsNote, createTeamNewsPost,
         recordSkillRoll, pickSkill, pickStatIncrease, signJourneyman, fireJourneyman,
         buyReroll, sackReroll, buyAssistantCoach, sackAssistantCoach, buyCheerleader, sackCheerleader,
         buyApothecary, sackApothecary, buyFanFactor, sackFanFactor, hasActiveMatch } from './actions'
import prisma from '@/lib/prisma'
import { getTeamNews } from '@/lib/queries/news'
import { skillRollsAvailable, improvementOptions, canIncreaseStat } from '@/lib/ssp'
import PlayerHistoryModal from './PlayerHistoryModal'
import LogoUpload from './LogoUpload'
import { getTeamLogo } from '@/lib/team-logo'

export const dynamic = 'force-dynamic'

interface Props {
  params:       Promise<{ id: string }>
  searchParams?: Promise<{ err?: string; tab?: string }>
}

// ── Colour maps ───────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  G: 'text-blue-300   border-blue-300/30   bg-blue-300/5',
  A: 'text-green-300  border-green-300/30  bg-green-300/5',
  P: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/5',
  S: 'text-red-300    border-red-300/30    bg-red-300/5',
  M: 'text-purple-300 border-purple-300/30 bg-purple-300/5',
  E: 'text-bb-crimson-bright border-bb-crimson-bright/30 bg-bb-crimson/5',
}

const PLAYER_STATUS_CLS: Record<string, string> = {
  ACTIVE: 'text-green-400        border-green-700/50   bg-green-900/10',
  MNG:    'text-amber-400        border-amber-700/50   bg-amber-900/10',
  SACKED: 'text-amber-500        border-amber-700/40   bg-amber-900/5',
  DEAD:   'text-bb-crimson-bright border-bb-crimson/50  bg-bb-crimson/5',
}
const PLAYER_STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  MNG:    'MNG',
  SACKED: 'Sacked',
  DEAD:   'R.I.P.',
}

const MATCH_STATUS_CLS: Record<string, string> = {
  SCHEDULED: 'text-bb-muted/70 border-bb-muted/30',
  LIVE:      'text-bb-crimson-bright border-bb-crimson-bright/40 bg-bb-crimson/10',
  COMPLETED: 'text-bb-gold/60 border-bb-gold/20',
}
const MATCH_STATUS_LABEL: Record<string, string> = {
  SCHEDULED: 'Scheduled',
  LIVE:      'LIVE',
  COMPLETED: 'Final',
}

const editBase = 'bg-transparent border border-transparent hover:border-bb-border/60 focus:border-bb-gold/40 rounded-sm outline-none transition-colors placeholder:text-bb-muted/30 text-sm'

// ── Helpers ───────────────────────────────────────────────────────────────────

function StatCell({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <td className={`px-2 py-3.5 text-center font-heading font-bold text-sm tabular-nums ${muted ? 'text-bb-muted/60' : 'text-white'}`}>
      {value}
    </td>
  )
}

function SectionRule({ title, right }: { title: string; right?: string }) {
  return (
    <div className="flex items-center gap-4 mb-4">
      <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase whitespace-nowrap">{title}</h2>
      <div className="flex-1 h-px bg-bb-border" />
      {right && <span className="text-bb-muted/50 text-xs">{right}</span>}
    </div>
  )
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="font-heading font-black text-bb-gold text-base">1</span>
  if (rank === 2) return <span className="font-heading font-bold text-slate-300 text-sm">2</span>
  if (rank === 3) return <span className="font-heading font-bold text-amber-700 text-sm">3</span>
  return <span className="font-heading text-sm text-bb-muted/40">{rank}</span>
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamPage({ params, searchParams }: Props) {
  const { id } = await params
  const sp = await searchParams
  const tab = sp?.tab ?? 'roster'

  const [team, session] = await Promise.all([getTeamById(id), getSession()])
  if (!team) notFound()

  const isOwner = session?.coachId === team.coachId
  const locked  = isOwner && await hasActiveMatch(team.id)
  const teamLogo = getTeamLogo(team.logoUrl, team.race.name)
  const maxSlots = team.league.ruleSet?.numberOfPlayers ?? 16
  const living     = team.players.filter((p) => p.status === 'ACTIVE' || p.status === 'MNG')
  const sacked     = team.players.filter((p) => p.status === 'SACKED')
  const deadHeroes = team.players.filter((p) => p.status === 'DEAD')
  const emptyCount = Math.max(0, maxSlots - living.length)
  const totalGames = team.wins + team.draws + team.losses
  const pts        = team.wins * 3 + team.draws
  const coachName  = team.coach.alias ?? team.coach.name

  const playerValue = living.reduce((sum, p) => sum + (p.value > 0 ? p.value : p.playerType.cost), 0)
  const rerollValue = team.rerolls * team.race.rerollPrice
  const staffValue  = team.assistantCoaches * 10000
                    + team.cheerleaders     * 10000
                    + team.fanFactor        * 10000
                    + (team.apothecary      ? 50000 : 0)
  const teamValue   = Math.round((playerValue + rerollValue + staffValue) / 1000)

  // ── Owner management data ─────────────────────────────────────────────────

  let coaches: { id: string; name: string; alias: string | null }[] = []
  let teamMatchCount = 0

  if (isOwner) {
    ;[coaches, teamMatchCount] = await Promise.all([
      prisma.coach.findMany({
        where:   { isActive: true, id: { not: team.coachId } },
        select:  { id: true, name: true, alias: true },
        orderBy: { name: 'asc' },
      }),
      prisma.match.count({
        where: { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      }),
    ])
  }

  const canDelete = teamMatchCount === 0

  // ── Roster tab data ───────────────────────────────────────────────────────

  let playerTypes: { id: string; name: string; cost: number; maxCount: number }[] = []
  let teamNews: Awaited<ReturnType<typeof getTeamNews>> = []
  let allSkills: { id: string; name: string; category: string }[] = []
  let pendingJourneymen: Awaited<ReturnType<typeof getPendingJourneymen>> = []
  let completedMatches: Awaited<ReturnType<typeof getTeamCompletedMatches>> = []

  if (tab === 'roster') {
    ;[playerTypes, completedMatches] = await Promise.all([
      prisma.playerType.findMany({
        where:   { raceId: team.raceId },
        orderBy: { cost: 'asc' },
        select:  { id: true, name: true, cost: true, maxCount: true },
      }),
      getTeamCompletedMatches(team.id),
    ])
    if (isOwner) {
      ;[allSkills, pendingJourneymen] = await Promise.all([
        prisma.skill.findMany({
          orderBy: { name: 'asc' },
          select:  { id: true, name: true, category: true },
        }),
        getPendingJourneymen(team.id),
      ])
    }
  }

  function skillsForRoll(skillRollNormal: string, skillRollDouble: string, isDouble: boolean, ownedIds: Set<string>) {
    const categories = new Set(skillRollNormal.split(''))
    if (isDouble) skillRollDouble.split('').forEach((c) => categories.add(c))
    return allSkills.filter((s) => categories.has(s.category) && !ownedIds.has(s.id))
  }

  if (tab === 'news') {
    teamNews = await getTeamNews(team.id)
  }

  // ── Conditional data ──────────────────────────────────────────────────────

  let matches: Awaited<ReturnType<typeof prisma.match.findMany<{
    include: { homeTeam: { select: { id: true; name: true } }; awayTeam: { select: { id: true; name: true } } }
  }>>> = []

  let standingTeams: { id: string; name: string; wins: number; draws: number; losses: number; teamValue: number; coach: { name: string; alias: string | null } }[] = []
  let pointsWin = 3, pointsDraw = 1, pointsLoss = 0

  if (tab === 'schedule') {
    matches = await prisma.match.findMany({
      where:   { OR: [{ homeTeamId: team.id }, { awayTeamId: team.id }] },
      include: {
        homeTeam: { select: { id: true, name: true } },
        awayTeam: { select: { id: true, name: true } },
      },
      orderBy: [{ round: 'asc' }, { scheduledAt: { sort: 'asc', nulls: 'last' } }],
    })
  }

  if (tab === 'standing' || tab === 'achievements') {
    const [teamsResult, leagueResult] = await Promise.all([
      prisma.team.findMany({
        where:   team.divisionId ? { divisionId: team.divisionId } : { leagueId: team.leagueId },
        include: {
          coach:   { select: { name: true, alias: true } },
          race:    { select: { rerollPrice: true } },
          players: { where: { status: { in: ['ACTIVE', 'MNG'] } }, select: { value: true, playerType: { select: { cost: true } } } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.league.findUnique({
        where:  { id: team.leagueId },
        select: { ruleSet: { select: { pointsWin: true, pointsDraw: true, pointsLoss: true } } },
      }),
    ])
    standingTeams = teamsResult.map((t) => {
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
      return { id: t.id, name: t.name, wins: t.wins, draws: t.draws, losses: t.losses, teamValue, coach: t.coach }
    })
    if (leagueResult?.ruleSet) {
      pointsWin  = leagueResult.ruleSet.pointsWin
      pointsDraw = leagueResult.ruleSet.pointsDraw
      pointsLoss = leagueResult.ruleSet.pointsLoss
    }
  }

  // Sort standing teams
  const sortedStanding = [...standingTeams].sort((a, b) => {
    const ptsA = a.wins * pointsWin + a.draws * pointsDraw + a.losses * pointsLoss
    const ptsB = b.wins * pointsWin + b.draws * pointsDraw + b.losses * pointsLoss
    if (ptsB !== ptsA) return ptsB - ptsA
    if (b.wins !== a.wins) return b.wins - a.wins
    if (b.draws !== a.draws) return b.draws - a.draws
    return a.losses - b.losses
  })
  const myRank = sortedStanding.findIndex((t) => t.id === team.id) + 1

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <Link
          href="/teams"
          className="inline-flex items-center gap-1.5 text-bb-muted text-xs uppercase tracking-widest hover:text-bb-gold transition-colors mb-8"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Teams
        </Link>

        {/* ── Team header ── */}
        <div className="mb-8 flex flex-col sm:flex-row items-start gap-4 sm:gap-8">
          <div className="flex-1 min-w-0">
            <h1 className="font-heading text-4xl font-black text-bb-gold tracking-widest uppercase mb-3">
              {team.name}
            </h1>

            <div className="flex flex-wrap gap-2 mb-5 text-xs">
              {!team.isActive && (
                <span className="px-2.5 py-1 rounded-sm border border-bb-muted/40 bg-bb-muted/10 text-bb-muted tracking-wide">
                  Inactive
                </span>
              )}
              <span className="px-2.5 py-1 rounded-sm border border-bb-border bg-bb-dark text-bb-muted tracking-wide">
                {team.race.name}
              </span>
              <span className="px-2.5 py-1 rounded-sm border border-bb-border bg-bb-dark text-bb-muted tracking-wide">
                {team.league.name}
              </span>
              {team.division && (
                <span className="px-2.5 py-1 rounded-sm border border-bb-border bg-bb-dark text-bb-muted tracking-wide">
                  {team.division.name}
                </span>
              )}
              <span className="px-2.5 py-1 rounded-sm border border-bb-border bg-bb-dark text-bb-muted tracking-wide">
                Coach: {coachName}
              </span>
            </div>

            <div className="flex items-center gap-5">
              <div className="text-center">
                <div className="text-2xl font-heading font-black text-green-400">{team.wins}</div>
                <div className="text-xs uppercase tracking-widest text-bb-muted">W</div>
              </div>
              <div className="text-bb-border font-thin">·</div>
              <div className="text-center">
                <div className="text-2xl font-heading font-black text-bb-muted">{team.draws}</div>
                <div className="text-xs uppercase tracking-widest text-bb-muted">D</div>
              </div>
              <div className="text-bb-border font-thin">·</div>
              <div className="text-center">
                <div className="text-2xl font-heading font-black text-bb-crimson-bright">{team.losses}</div>
                <div className="text-xs uppercase tracking-widest text-bb-muted">L</div>
              </div>
              <div className="text-bb-border font-thin">·</div>
              <div className="text-center">
                <div className="text-2xl font-heading font-black text-bb-gold">{pts}</div>
                <div className="text-xs uppercase tracking-widest text-bb-muted">Pts</div>
              </div>
            </div>
          </div>

          <LogoUpload
            teamId={team.id}
            currentLogo={teamLogo}
            raceName={team.race.name}
            isOwner={isOwner}
          />
        </div>

        {/* ── Tab navigation ── */}
        <nav className="flex flex-wrap gap-1.5 mb-8 border-b border-bb-border pb-0">
          {(['roster', 'schedule', 'standing', 'achievements', 'news'] as const).map((t) => {
            const labels = { roster: 'Roster', schedule: 'Schedule', standing: 'Standing', achievements: 'Honours', news: 'Team News' }
            return (
              <Link
                key={t}
                href={`/teams/${team.id}?tab=${t}${t === 'roster' && sp?.err ? `&err=${sp.err}` : ''}`}
                className={`px-5 py-2.5 text-xs font-heading tracking-widest uppercase border-b-2 -mb-px transition-colors ${
                  tab === t
                    ? 'border-bb-gold text-bb-gold'
                    : 'border-transparent text-bb-muted hover:text-white'
                }`}
              >
                {labels[t]}
              </Link>
            )
          })}
        </nav>

        {/* ══ TAB: ROSTER ══════════════════════════════════════════════════════ */}
        {tab === 'roster' && (
          <>
            {sp?.err === 'dup_number' && (
              <div className="mb-6 px-4 py-3 bg-amber-900/20 border border-amber-700/40 rounded-sm text-amber-300 text-sm">
                That jersey number is already taken — choose a different one.
              </div>
            )}

            {/* Per-row forms rendered outside the table */}
            {isOwner && living.map((player) => (
              <form key={player.id} id={`pf-${player.id}`} action={updatePlayer}>
                <input type="hidden" name="playerId" value={player.id} />
              </form>
            ))}

            {/* Team Info */}
            <section className="mb-10">
              <SectionRule title="Team Info" right={`TV ${teamValue.toLocaleString()}`} />

              {locked && (
                <div className="mb-3 px-4 py-3 bg-amber-900/20 border border-amber-700/40 rounded-sm text-amber-300 text-sm">
                  Roster locked — this team has a match in progress. Changes resume once it&rsquo;s completed.
                </div>
              )}

              {isOwner && !locked ? (
                <form action={updateTeamInfo} className="bg-bb-dark border border-bb-border rounded-sm p-4 space-y-4">
                  <input type="hidden" name="teamId" value={team.id} />

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div className="bg-bb-darker rounded-sm p-3 space-y-1">
                      <div className="text-bb-muted text-xs uppercase tracking-widest">Team Value</div>
                      <div className="font-heading font-black text-bb-gold text-xl tabular-nums">{teamValue.toLocaleString()}</div>
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-1">
                      <label className="text-bb-muted text-xs uppercase tracking-widest block">Treasury (gp)</label>
                      <input name="treasury" type="number" min={0} step={1000} defaultValue={team.treasury}
                        className="font-heading font-black text-white text-xl tabular-nums bg-transparent outline-none w-full focus:text-bb-gold transition-colors" />
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-2">
                      <div className="text-bb-muted text-xs uppercase tracking-widest">Re-Rolls</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">
                        {team.rerolls} <span className="text-bb-muted/50 text-sm font-normal">/ 8</span>
                      </div>
                      <div className="flex gap-2">
                        <button type="submit" formAction={buyReroll}
                          disabled={team.treasury < (totalGames > 0 ? team.race.rerollPrice * 2 : team.race.rerollPrice) || team.rerolls >= 8}
                          title={totalGames > 0
                            ? `Costs ${(team.race.rerollPrice * 2).toLocaleString()} gp — no refund on sack`
                            : `Costs ${team.race.rerollPrice.toLocaleString()} gp — full refund on sack before your first match`}
                          className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          + Buy ({(totalGames > 0 ? team.race.rerollPrice * 2 : team.race.rerollPrice).toLocaleString()})
                        </button>
                        <button type="submit" formAction={sackReroll}
                          disabled={team.rerolls <= 0}
                          title={totalGames > 0 ? 'No refund' : 'Full refund'}
                          className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-border text-bb-muted hover:text-bb-crimson hover:border-bb-crimson disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          − Sack
                        </button>
                      </div>
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-2">
                      <div className="text-bb-muted text-xs uppercase tracking-widest">Asst. Coaches</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">{team.assistantCoaches}</div>
                      <div className="flex gap-2">
                        <button type="submit" formAction={buyAssistantCoach}
                          disabled={team.treasury < 10000}
                          title={totalGames > 0 ? 'Costs 10,000 gp — no refund on sack' : 'Costs 10,000 gp — full refund on sack before your first match'}
                          className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          + Buy (10,000)
                        </button>
                        <button type="submit" formAction={sackAssistantCoach}
                          disabled={team.assistantCoaches <= 0}
                          title={totalGames > 0 ? 'No refund' : 'Full refund'}
                          className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-border text-bb-muted hover:text-bb-crimson hover:border-bb-crimson disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          − Sack
                        </button>
                      </div>
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-2">
                      <div className="text-bb-muted text-xs uppercase tracking-widest">Cheerleaders</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">{team.cheerleaders}</div>
                      <div className="flex gap-2">
                        <button type="submit" formAction={buyCheerleader}
                          disabled={team.treasury < 10000}
                          title={totalGames > 0 ? 'Costs 10,000 gp — no refund on sack' : 'Costs 10,000 gp — full refund on sack before your first match'}
                          className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          + Buy (10,000)
                        </button>
                        <button type="submit" formAction={sackCheerleader}
                          disabled={team.cheerleaders <= 0}
                          title={totalGames > 0 ? 'No refund' : 'Full refund'}
                          className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-border text-bb-muted hover:text-bb-crimson hover:border-bb-crimson disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                          − Sack
                        </button>
                      </div>
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-1">
                      <label className="text-bb-muted text-xs uppercase tracking-widest block">Fan Factor</label>
                      {totalGames > 0 ? (
                        <>
                          <div className="font-heading font-black text-white text-xl tabular-nums">{team.fanFactor}</div>
                          <p className="text-[10px] text-bb-muted/50 italic">Locked after first match — adjust via the Fans &amp; FAME roll each match.</p>
                        </>
                      ) : (
                        <div className="space-y-2">
                          <div className="font-heading font-black text-white text-xl tabular-nums">{team.fanFactor} <span className="text-bb-muted/50 text-sm font-normal">/ 9</span></div>
                          <div className="flex gap-2">
                            <button type="submit" formAction={buyFanFactor}
                              disabled={team.treasury < 10000 || team.fanFactor >= 9}
                              title="Costs 10,000 gp — full refund on sack before your first match"
                              className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              + Buy (10,000)
                            </button>
                            <button type="submit" formAction={sackFanFactor}
                              disabled={team.fanFactor <= 0}
                              title="Full refund"
                              className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-border text-bb-muted hover:text-bb-crimson hover:border-bb-crimson disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              − Sack
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {team.race.hasApothecary ? (
                      <div className="bg-bb-darker rounded-sm p-3 space-y-2">
                        <div className="text-bb-muted text-xs uppercase tracking-widest">Apothecary</div>
                        <div className={`font-heading font-black text-xl ${team.apothecary ? 'text-green-400' : 'text-bb-muted/50'}`}>
                          {team.apothecary ? 'Yes' : 'No'}
                        </div>
                        <div className="flex gap-2">
                          <button type="submit" formAction={buyApothecary}
                            disabled={team.apothecary || team.treasury < 50000}
                            title={totalGames > 0 ? 'Costs 50,000 gp — no refund on sack' : 'Costs 50,000 gp — full refund on sack before your first match'}
                            className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            + Buy (50,000)
                          </button>
                          <button type="submit" formAction={sackApothecary}
                            disabled={!team.apothecary}
                            title={totalGames > 0 ? 'No refund' : 'Full refund'}
                            className="px-2 py-1 text-xs font-heading uppercase tracking-wider rounded-sm border border-bb-border text-bb-muted hover:text-bb-crimson hover:border-bb-crimson disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            − Sack
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-bb-darker rounded-sm p-3 space-y-1 opacity-40">
                        <div className="text-bb-muted text-xs uppercase tracking-widest">Apothecary</div>
                        <div className="font-heading font-black text-bb-muted text-xl">N/A</div>
                      </div>
                    )}
                  </div>

                  <div className="pt-1 border-t border-bb-border/40 flex justify-end">
                    <button type="submit" className="text-xs font-medium uppercase tracking-widest px-4 py-2 rounded-sm border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted transition-colors">
                      Save Team Info
                    </button>
                  </div>
                </form>
              ) : (
                <div className="bg-bb-dark border border-bb-border rounded-sm p-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                    <div className="bg-bb-darker rounded-sm p-3">
                      <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Team Value</div>
                      <div className="font-heading font-black text-bb-gold text-xl tabular-nums">{teamValue.toLocaleString()}</div>
                    </div>
                    <div className="bg-bb-darker rounded-sm p-3">
                      <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Treasury</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">{team.treasury.toLocaleString()} <span className="text-bb-muted text-sm font-normal">gp</span></div>
                    </div>
                    <div className="bg-bb-darker rounded-sm p-3">
                      <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Re-Rolls</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">{team.rerolls} <span className="text-bb-muted/50 text-sm font-normal">/ 8</span></div>
                    </div>
                    <div className="bg-bb-darker rounded-sm p-3">
                      <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Asst. Coaches</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">{team.assistantCoaches}</div>
                    </div>
                    <div className="bg-bb-darker rounded-sm p-3">
                      <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Cheerleaders</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">{team.cheerleaders}</div>
                    </div>
                    <div className="bg-bb-darker rounded-sm p-3">
                      <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Fan Factor</div>
                      <div className="font-heading font-black text-white text-xl tabular-nums">{team.fanFactor}</div>
                    </div>
                    <div className="bg-bb-darker rounded-sm p-3">
                      <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Apothecary</div>
                      {team.race.hasApothecary ? (
                        <div className={`font-heading font-black text-xl ${team.apothecary ? 'text-green-400' : 'text-bb-muted/50'}`}>
                          {team.apothecary ? 'Yes' : 'No'}
                        </div>
                      ) : (
                        <div className="font-heading font-black text-bb-muted/40 text-xl">N/A</div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* Pending Journeymen */}
            {isOwner && pendingJourneymen.length > 0 && (
              <section className="mb-14">
                <SectionRule title="Pending Journeymen" right={`${pendingJourneymen.length}`} />
                <div className="space-y-2">
                  {pendingJourneymen.map((j) => (
                    <div key={j.id} className="bg-bb-dark border border-bb-gold/20 rounded-sm p-4 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-white font-heading">
                          {j.playerType.name} <span className="text-bb-muted">— Round {j.match.round}, {j.match.homeTeam.name} v {j.match.awayTeam.name}</span>
                        </p>
                        <p className="text-xs text-bb-muted mt-1">
                          TD {j.touchdowns} · CP {j.completePasses} · Int {j.interceptions} · Cas {j.casualties} · MVP {j.mvp} · SSP {j.ssp}
                          {j.injuryStatus !== 'ACTIVE' && <span className="ml-2 text-amber-400">({j.injuryStatus})</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {j.injuryStatus !== 'DEAD' && (
                          <form action={signJourneyman}>
                            <input type="hidden" name="journeymanId" value={j.id} />
                            <button type="submit" disabled={locked} title={locked ? 'Roster locked — match in progress' : undefined}
                              className="px-3 py-1.5 rounded-sm border border-bb-gold/50 text-bb-gold text-xs font-heading uppercase tracking-wider hover:bg-bb-gold hover:text-bb-dark transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                              Sign ({j.playerType.cost.toLocaleString()} gp)
                            </button>
                          </form>
                        )}
                        <form action={fireJourneyman}>
                          <input type="hidden" name="journeymanId" value={j.id} />
                          <button type="submit" disabled={locked} title={locked ? 'Roster locked — match in progress' : undefined}
                            className="px-3 py-1.5 rounded-sm border border-bb-border text-bb-muted text-xs font-heading uppercase tracking-wider hover:border-bb-crimson hover:text-bb-crimson transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            Fire
                          </button>
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Roster table */}
            <section className="mb-14">
              <SectionRule title="Roster" right={`${living.length} / ${maxSlots} slots`} />

              <div className="overflow-x-auto rounded-sm">
                <table className="w-full min-w-[1100px] bg-bb-dark border border-bb-gold/20 shadow-xl shadow-black/50">
                  <thead>
                    <tr className="text-xs font-heading tracking-widest uppercase text-bb-muted/60 bg-bb-darker border-b border-bb-border">
                      <th className="px-3 py-3 text-center w-16">#</th>
                      <th className="px-3 py-3 text-left">Name</th>
                      <th className="px-3 py-3 text-left">Position</th>
                      <th className="px-2 py-3 text-center w-10">MA</th>
                      <th className="px-2 py-3 text-center w-10">ST</th>
                      <th className="px-2 py-3 text-center w-10">AG</th>
                      <th className="px-2 py-3 text-center w-10">AV</th>
                      <th className="px-3 py-3 text-left">Skills</th>
                      <th className="px-2 py-3 text-center w-12" title="Complete Passes">CP</th>
                      <th className="px-2 py-3 text-center w-12" title="Touchdowns">TD</th>
                      <th className="px-2 py-3 text-center w-12" title="Interceptions">Int</th>
                      <th className="px-2 py-3 text-center w-12" title="Casualties">Cas</th>
                      <th className="px-2 py-3 text-center w-12" title="Most Valuable Player awards">MVP</th>
                      <th className="px-2 py-3 text-center w-12" title="Star Player Points">SSP</th>
                      <th className="px-3 py-3 text-left w-24" title="Niggling Injuries">NIG</th>
                      <th className="px-2 py-3 text-center w-20" title="Player value in gold pieces">Value</th>
                      <th className="px-3 py-3 text-center w-24">Status</th>
                      <th className="px-2 py-3 text-center w-16" title="Match history">Hist</th>
                      {isOwner && <th className="px-2 py-3 w-28" />}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-bb-border/50">
                    {living.map((player, i) => (
                      <tr key={player.id} className={player.status === 'MNG' ? 'bg-amber-900/5' : i % 2 !== 0 ? 'bg-white/[0.02]' : ''}>
                        <td className="px-2 py-2 text-center w-16">
                          {isOwner ? (
                            <input form={`pf-${player.id}`} name="number" type="number" min={1} max={99} defaultValue={player.number}
                              className={`${editBase} font-heading font-bold text-bb-gold text-center tabular-nums w-14 px-1.5 py-1`} />
                          ) : (
                            <span className="font-heading font-bold text-bb-gold text-sm tabular-nums">{player.number}</span>
                          )}
                        </td>
                        <td className="px-2 py-2">
                          {isOwner ? (
                            <input form={`pf-${player.id}`} name="name" type="text" defaultValue={player.name ?? ''} placeholder="Unnamed" maxLength={40}
                              className={`${editBase} text-white font-medium w-full min-w-[8rem] px-2 py-1`} />
                          ) : (
                            <span className="text-sm text-white font-medium px-1">
                              {player.name ?? <span className="text-bb-muted/40 italic font-normal">—</span>}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3.5 text-sm text-bb-muted">{player.playerType.name}</td>
                        <StatCell value={player.playerType.ma + player.maIncrease} />
                        <StatCell value={player.playerType.st + player.stIncrease} />
                        <StatCell value={player.playerType.ag + player.agIncrease} />
                        <StatCell value={player.playerType.av + player.avIncrease} />
                        <td className="px-3 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {[...player.playerType.startingSkills, ...player.learnedSkills].length === 0 ? (
                              <span className="text-bb-muted/30 text-xs">—</span>
                            ) : (
                              [...player.playerType.startingSkills, ...player.learnedSkills].map((s) => (
                                <span key={s.name} title={s.skillRule} className={`text-xs px-1.5 py-0.5 rounded-sm border cursor-help ${CAT_COLOR[s.category] ?? ''}`}>
                                  {s.name}
                                </span>
                              ))
                            )}
                          </div>
                          {isOwner && (
                            <div className="mt-1.5 space-y-1">
                              {skillRollsAvailable(player.ssp, player._count.skillRolls) > 0 && (
                                <details className="text-xs">
                                  <summary className="cursor-pointer text-bb-gold hover:text-bb-gold-dim font-heading uppercase tracking-wider text-[10px]">
                                    🎲 Skill Up
                                  </summary>
                                  <form action={recordSkillRoll} className="mt-1 flex items-center gap-1 flex-wrap">
                                    <input type="hidden" name="playerId" value={player.id} />
                                    <select name="die1" defaultValue="" required
                                      className="bg-bb-darker border border-bb-border rounded-sm px-1 py-0.5 text-xs text-white">
                                      <option value="" disabled>D1</option>
                                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <span className="text-bb-muted">+</span>
                                    <select name="die2" defaultValue="" required
                                      className="bg-bb-darker border border-bb-border rounded-sm px-1 py-0.5 text-xs text-white">
                                      <option value="" disabled>D2</option>
                                      {[1, 2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n}</option>)}
                                    </select>
                                    <button type="submit"
                                      className="px-2 py-0.5 rounded-sm border border-bb-gold/50 text-bb-gold text-[10px] font-heading uppercase hover:bg-bb-gold hover:text-bb-dark transition-colors">
                                      Roll
                                    </button>
                                  </form>
                                </details>
                              )}
                              {player.skillRolls.map((roll) => {
                                const isDouble     = roll.die1 === roll.die2
                                const ownedSkillIds = new Set([
                                  ...player.playerType.startingSkills.map((s) => s.id),
                                  ...player.learnedSkills.map((s) => s.id),
                                ])
                                const options  = skillsForRoll(player.playerType.skillRollNormal, player.playerType.skillRollDouble, isDouble, ownedSkillIds)
                                const { statOptions } = improvementOptions(roll.die1, roll.die2)
                                const statBase: Record<string, number> = {
                                  MA: player.playerType.ma, ST: player.playerType.st, AG: player.playerType.ag, AV: player.playerType.av,
                                }
                                const statCurrent: Record<string, number> = {
                                  MA: player.maIncrease, ST: player.stIncrease, AG: player.agIncrease, AV: player.avIncrease,
                                }
                                const availableStatOptions = statOptions.filter((s) => canIncreaseStat(statBase[s], statCurrent[s]))
                                return (
                                  <details key={roll.id} className="text-xs">
                                    <summary className="cursor-pointer text-bb-gold hover:text-bb-gold-dim font-heading uppercase tracking-wider text-[10px]">
                                      🎯 Pick Skill ({roll.die1}+{roll.die2}{isDouble ? ', doubles!' : ''})
                                    </summary>
                                    <form action={pickSkill} className="mt-1 flex items-center gap-1">
                                      <input type="hidden" name="rollId" value={roll.id} />
                                      <select name="skillId" defaultValue="" required
                                        className="bg-bb-darker border border-bb-border rounded-sm px-1 py-0.5 text-xs text-white max-w-[10rem]">
                                        <option value="" disabled>Select skill…</option>
                                        {(['G', 'A', 'P', 'S', 'M', 'E'] as const).map((cat) => {
                                          const inCat = options.filter((s) => s.category === cat)
                                          if (inCat.length === 0) return null
                                          return (
                                            <optgroup key={cat} label={cat}>
                                              {inCat.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </optgroup>
                                          )
                                        })}
                                      </select>
                                      <button type="submit"
                                        className="px-2 py-0.5 rounded-sm border border-bb-gold/50 text-bb-gold text-[10px] font-heading uppercase hover:bg-bb-gold hover:text-bb-dark transition-colors">
                                        Learn
                                      </button>
                                    </form>
                                    {availableStatOptions.length > 0 && (
                                      <form action={pickStatIncrease} className="mt-1 flex items-center gap-1">
                                        <input type="hidden" name="rollId" value={roll.id} />
                                        <span className="text-bb-muted">or</span>
                                        <select name="stat" defaultValue="" required
                                          className="bg-bb-darker border border-bb-border rounded-sm px-1 py-0.5 text-xs text-white">
                                          <option value="" disabled>Stat…</option>
                                          {availableStatOptions.map((s) => <option key={s} value={s}>+1 {s}</option>)}
                                        </select>
                                        <button type="submit"
                                          className="px-2 py-0.5 rounded-sm border border-bb-gold/50 text-bb-gold text-[10px] font-heading uppercase hover:bg-bb-gold hover:text-bb-dark transition-colors">
                                          Increase
                                        </button>
                                      </form>
                                    )}
                                  </details>
                                )
                              })}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.completePasses}</td>
                        <td className="px-2 py-3.5 text-center text-sm font-bold text-bb-gold tabular-nums">{player.touchdowns}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.interceptions}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.casualties}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.mvp}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.ssp}</td>
                        <td className="px-3 py-3.5 text-xs text-bb-crimson-bright">
                          {player.nigglingInjuries > 0 ? player.nigglingInjuries : <span className="text-bb-muted/30">—</span>}
                        </td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-gold tabular-nums font-mono">
                          {(player.value > 0 ? player.value : player.playerType.cost).toLocaleString()}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-sm border ${PLAYER_STATUS_CLS[player.status]}`}>
                            {PLAYER_STATUS_LABEL[player.status]}
                          </span>
                        </td>
                        <td className="px-2 py-3.5 text-center">
                          {completedMatches.length > 0 ? (
                            <PlayerHistoryModal
                              playerName={player.name ?? player.playerType.name}
                              playerNumber={player.number}
                              playerPosition={player.playerType.name}
                              teamId={team.id}
                              teamMatches={completedMatches}
                              matchStats={player.matchStats}
                            />
                          ) : (
                            <span className="text-bb-muted/20 text-xs">—</span>
                          )}
                        </td>
                        {isOwner && (
                          <td className="px-2 py-2 text-center">
                            <div className="flex items-center justify-center gap-1">
                              {/* Save */}
                              <button form={`pf-${player.id}`} type="submit" title="Save changes"
                                className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-bb-border/60 text-bb-muted/60 hover:border-bb-gold hover:text-bb-gold transition-colors">
                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                              </button>
                              {/* Sack */}
                              <form action={sackPlayer}>
                                <input type="hidden" name="playerId" value={player.id} />
                                <button type="submit" disabled={locked}
                                  title={locked ? 'Roster locked — match in progress' : totalGames > 0 ? 'Sack player (no refund)' : 'Sack player (full refund)'}
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-bb-border/60 text-bb-muted/60 hover:border-amber-600 hover:text-amber-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                  </svg>
                                </button>
                              </form>
                            </div>
                          </td>
                        )}
                      </tr>
                    ))}

                    {Array.from({ length: emptyCount }, (_, i) => (
                      <tr key={`empty-${i}`} className="opacity-25">
                        <td className="px-3 py-3 text-center font-heading text-bb-muted/50 text-sm tabular-nums">{living.length + i + 1}</td>
                        <td className="px-3 py-3 text-xs text-bb-muted/40 italic">Empty slot</td>
                        <td className="px-3 py-3 text-bb-muted/30 text-xs">—</td>
                        <td colSpan={13} />
                        <td />{/* Status */}
                        <td />{/* Hist */}
                        {isOwner && !locked ? (
                          <td className="px-2 py-2 text-center opacity-100">
                            <a href="#recruit" title="Recruit player"
                              className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-bb-gold/30 text-bb-gold/50 hover:border-bb-gold hover:text-bb-gold transition-colors">
                              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </a>
                          </td>
                        ) : (
                          <td />
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Recruit Player (owner only, empty slots available) */}
            {isOwner && !locked && emptyCount > 0 && (
              <section className="mb-10" id="recruit">
                <SectionRule
                  title="Recruit Player"
                  right={`Treasury: ${team.treasury.toLocaleString()} gp`}
                />
                {(() => {
                  const typeCounts = new Map(
                    playerTypes.map((pt) => [pt.id, living.filter((p) => p.playerTypeId === pt.id).length])
                  )
                  const hasAffordable = playerTypes.some(
                    (pt) => team.treasury >= pt.cost && (typeCounts.get(pt.id) ?? 0) < pt.maxCount
                  )
                  if (!hasAffordable) {
                    return (
                      <p className="text-bb-muted/50 text-sm italic">
                        {playerTypes.every((pt) => team.treasury < pt.cost)
                          ? 'Not enough gold to recruit any player.'
                          : 'All available positions are full.'}
                      </p>
                    )
                  }
                  return (
                    <form action={buyPlayer} className="flex flex-wrap items-end gap-3 bg-bb-dark border border-bb-border rounded-sm p-4">
                      <input type="hidden" name="teamId" value={team.id} />
                      <div className="space-y-1">
                        <label className="text-bb-muted text-xs uppercase tracking-widest block">Position</label>
                        <select name="playerTypeId" required
                          className="bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 w-full sm:w-auto sm:min-w-[260px]">
                          {playerTypes.map((pt) => {
                            const count = typeCounts.get(pt.id) ?? 0
                            const full  = count >= pt.maxCount
                            const broke = team.treasury < pt.cost
                            return (
                              <option key={pt.id} value={pt.id} disabled={full || broke}>
                                {pt.name} — {pt.cost.toLocaleString()} gp
                                {full ? ` (Full ${count}/${pt.maxCount})` : broke ? " (Can't afford)" : ''}
                              </option>
                            )
                          })}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-bb-muted text-xs uppercase tracking-widest block">Jersey #</label>
                        <input name="number" type="number" min={1} max={99} required placeholder="1–99"
                          className="bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 w-24" />
                      </div>
                      <button type="submit"
                        className="text-xs font-medium uppercase tracking-widest px-4 py-2 rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 transition-colors">
                        Recruit
                      </button>
                    </form>
                  )
                })()}
              </section>
            )}

            {/* Former Players (Sacked) */}
            {sacked.length > 0 && (
              <section className="mb-10">
                <div className="flex items-center gap-4 mb-4">
                  <h2 className="font-heading text-lg font-bold text-amber-500/70 tracking-widest uppercase">Former Players</h2>
                  <div className="flex-1 h-px bg-amber-900/30" />
                  <span className="text-bb-muted/50 text-xs">{sacked.length}</span>
                </div>
                <div className="overflow-x-auto rounded-sm">
                  <table className="w-full min-w-[900px] bg-bb-dark border border-amber-900/30 shadow-xl shadow-black/50">
                    <thead>
                      <tr className="text-xs font-heading tracking-widest uppercase text-bb-muted/40 bg-bb-darker border-b border-amber-900/20">
                        <th className="px-3 py-3 text-center w-10">#</th>
                        <th className="px-3 py-3 text-left">Name</th>
                        <th className="px-3 py-3 text-left">Position</th>
                        <th className="px-2 py-3 text-center w-12">TD</th>
                        <th className="px-2 py-3 text-center w-12">Cas</th>
                        <th className="px-2 py-3 text-center w-12">MVP</th>
                        <th className="px-2 py-3 text-center w-12">SSP</th>
                        <th className="px-3 py-3 text-center w-28">Reinstate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-900/15">
                      {sacked.map((player, i) => {
                        const windowOpen  = player.teamGamesAtSack === totalGames
                        const hasRoom     = living.length < maxSlots
                        const canReinstate = isOwner && windowOpen && hasRoom
                        return (
                          <tr key={player.id} className={`opacity-60 ${i % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}>
                            <td className="px-3 py-3.5 text-center font-heading font-bold text-bb-muted text-sm tabular-nums">{player.number}</td>
                            <td className="px-3 py-3.5 text-sm text-bb-muted">
                              {player.name ?? <span className="italic font-normal text-bb-muted/40">—</span>}
                            </td>
                            <td className="px-3 py-3.5 text-sm text-bb-muted/60">{player.playerType.name}</td>
                            <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.touchdowns}</td>
                            <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.casualties}</td>
                            <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.mvp}</td>
                            <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.ssp}</td>
                            <td className="px-2 py-3.5 text-center">
                              {canReinstate ? (
                                <form action={reinstatePlayer}>
                                  <input type="hidden" name="playerId" value={player.id} />
                                  <button type="submit" disabled={locked} title={locked ? 'Roster locked — match in progress' : undefined}
                                    className="text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-sm border border-amber-700/50 text-amber-400 hover:bg-amber-900/20 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                                    Reinstate
                                  </button>
                                </form>
                              ) : (
                                <span className="text-bb-muted/30 text-xs italic">
                                  {isOwner && !windowOpen ? 'Window closed' : isOwner && !hasRoom ? 'Roster full' : '—'}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Fallen Heroes */}
            {deadHeroes.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-4">
                  <h2 className="font-heading text-lg font-bold text-bb-crimson-bright/70 tracking-widest uppercase">Fallen Heroes</h2>
                  <div className="flex-1 h-px bg-bb-crimson/20" />
                  <span className="text-bb-muted/50 text-xs">{deadHeroes.length}</span>
                </div>
                <div className="overflow-x-auto rounded-sm">
                  <table className="w-full min-w-[1100px] bg-bb-dark border border-bb-crimson/20 shadow-xl shadow-black/50">
                    <thead>
                      <tr className="text-xs font-heading tracking-widest uppercase text-bb-muted/40 bg-bb-darker border-b border-bb-crimson/20">
                        <th className="px-3 py-3 text-center w-10">#</th>
                        <th className="px-3 py-3 text-left">Name</th>
                        <th className="px-3 py-3 text-left">Position</th>
                        <th className="px-2 py-3 text-center w-10">MA</th>
                        <th className="px-2 py-3 text-center w-10">ST</th>
                        <th className="px-2 py-3 text-center w-10">AG</th>
                        <th className="px-2 py-3 text-center w-10">AV</th>
                        <th className="px-3 py-3 text-left">Skills</th>
                        <th className="px-2 py-3 text-center w-12">CP</th>
                        <th className="px-2 py-3 text-center w-12">TD</th>
                        <th className="px-2 py-3 text-center w-12">Int</th>
                        <th className="px-2 py-3 text-center w-12">Cas</th>
                        <th className="px-2 py-3 text-center w-12">MVP</th>
                        <th className="px-2 py-3 text-center w-12">SSP</th>
                        <th className="px-3 py-3 text-left w-24">NIG</th>
                        <th className="px-2 py-3 text-center w-20">Value</th>
                        <th className="px-3 py-3 text-center w-24">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-bb-crimson/10">
                      {deadHeroes.map((player, i) => (
                        <tr key={player.id} className={`opacity-55 ${i % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}>
                          <td className="px-3 py-3.5 text-center font-heading font-bold text-bb-muted text-sm tabular-nums">{player.number}</td>
                          <td className="px-3 py-3.5 text-sm text-bb-muted line-through">
                            {player.name ?? <span className="no-underline italic font-normal">—</span>}
                          </td>
                          <td className="px-3 py-3.5 text-sm text-bb-muted/60">{player.playerType.name}</td>
                          <StatCell value={player.playerType.ma + player.maIncrease} muted />
                          <StatCell value={player.playerType.st + player.stIncrease} muted />
                          <StatCell value={player.playerType.ag + player.agIncrease} muted />
                          <StatCell value={player.playerType.av + player.avIncrease} muted />
                          <td className="px-3 py-3.5">
                            <div className="flex flex-wrap gap-1 opacity-40">
                              {player.playerType.startingSkills.map((s) => (
                                <span key={s.name} title={s.skillRule} className={`text-xs px-1.5 py-0.5 rounded-sm border cursor-help ${CAT_COLOR[s.category] ?? ''}`}>
                                  {s.name}
                                </span>
                              ))}
                            </div>
                          </td>
                          <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.completePasses}</td>
                          <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.touchdowns}</td>
                          <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.interceptions}</td>
                          <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.casualties}</td>
                          <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.mvp}</td>
                          <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.ssp}</td>
                          <td className="px-3 py-3.5 text-xs text-bb-muted/60">{player.nigglingInjuries > 0 ? player.nigglingInjuries : '—'}</td>
                          <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums font-mono">
                            {(player.value > 0 ? player.value : player.playerType.cost).toLocaleString()}
                          </td>
                          <td className="px-3 py-3.5 text-center">
                            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-sm border ${PLAYER_STATUS_CLS['DEAD']}`}>
                              <svg className="w-3 h-3 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2a9 9 0 00-9 9c0 3.4 1.9 6.4 4.7 8H7v3h10v-3h-.7C19.1 17.4 21 14.4 21 11a9 9 0 00-9-9zm-2 10a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm4 0a1.5 1.5 0 110-3 1.5 1.5 0 010 3zm-4 3h4v1H10v-1z"/>
                              </svg>
                              R.I.P.
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* ── Team Management (owner only) ── */}
            {isOwner && (
              <section className="mt-14">
                <div className="flex items-center gap-4 mb-5">
                  <h2 className="font-heading text-sm font-bold text-bb-muted/60 tracking-widest uppercase whitespace-nowrap">Team Management</h2>
                  <div className="flex-1 h-px bg-bb-border/50" />
                </div>

                <div className="space-y-3">

                  {/* Activate / Deactivate */}
                  <div className="flex items-center justify-between bg-bb-dark border border-bb-border rounded-sm px-5 py-4">
                    <div>
                      <p className="text-sm text-white font-medium">Status</p>
                      <p className="text-xs text-bb-muted mt-0.5">
                        {team.isActive
                          ? 'Team is active and visible in the league.'
                          : 'Team is inactive and hidden from standings.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-4">
                      <span className={`text-xs font-heading tracking-wider uppercase px-2 py-1 rounded-sm border ${
                        team.isActive
                          ? 'text-green-400 border-green-700/50 bg-green-900/10'
                          : 'text-bb-muted border-bb-muted/30 bg-bb-muted/5'
                      }`}>
                        {team.isActive ? 'Active' : 'Inactive'}
                      </span>
                      {team.isActive ? (
                        <form action={deactivateTeam}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <button type="submit" className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm border border-amber-700/40 text-amber-400 hover:bg-amber-900/20 transition-colors">
                            Deactivate
                          </button>
                        </form>
                      ) : (
                        <form action={activateTeam}>
                          <input type="hidden" name="teamId" value={team.id} />
                          <button type="submit" className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm border border-green-700/50 text-green-400 hover:bg-green-900/20 transition-colors">
                            Activate
                          </button>
                        </form>
                      )}
                    </div>
                  </div>

                  {/* Assign to another coach */}
                  <div className="bg-bb-dark border border-bb-border rounded-sm px-5 py-4">
                    <p className="text-sm text-white font-medium mb-0.5">Assign to Another Coach</p>
                    <p className="text-xs text-bb-muted mb-4">Transfer ownership of this team to a different coach.</p>
                    {coaches.length === 0 ? (
                      <p className="text-xs text-bb-muted/50 italic">No other active coaches available.</p>
                    ) : (
                      <form action={assignTeam} className="flex flex-wrap items-center gap-2">
                        <input type="hidden" name="teamId" value={team.id} />
                        <select
                          name="coachId"
                          required
                          className="bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60"
                        >
                          <option value="">Select coach…</option>
                          {coaches.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.alias ?? c.name}
                            </option>
                          ))}
                        </select>
                        <button type="submit" className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted transition-colors">
                          Assign Team
                        </button>
                      </form>
                    )}
                  </div>

                  {/* Delete */}
                  <div className="bg-bb-dark border border-bb-crimson/30 rounded-sm px-5 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm text-bb-crimson-bright font-medium mb-0.5">Delete Team</p>
                        {canDelete ? (
                          <p className="text-xs text-bb-muted">Permanently removes the team and all its players. This cannot be undone.</p>
                        ) : (
                          <p className="text-xs text-bb-muted">
                            Cannot delete — this team has {teamMatchCount} match{teamMatchCount !== 1 ? 'es' : ''} on record.
                            Deactivate the team instead.
                          </p>
                        )}
                      </div>
                      <form action={deleteTeam}>
                        <input type="hidden" name="teamId" value={team.id} />
                        <button
                          type="submit"
                          disabled={!canDelete}
                          className={`shrink-0 text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm border transition-colors ${
                            canDelete
                              ? 'border-bb-crimson/50 text-bb-crimson-bright hover:bg-bb-crimson/20'
                              : 'border-bb-border/30 text-bb-muted/30 cursor-not-allowed'
                          }`}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>

                </div>
              </section>
            )}
          </>
        )}

        {/* ══ TAB: SCHEDULE ════════════════════════════════════════════════════ */}
        {tab === 'schedule' && (
          <section>
            {matches.length === 0 ? (
              <div className="bg-bb-dark border border-bb-border rounded-sm p-10 text-center">
                <p className="text-bb-muted text-sm italic">No matches scheduled yet.</p>
              </div>
            ) : (
              <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-x-auto shadow-lg shadow-black/40">
                {/* Header */}
                <div className="grid grid-cols-[48px_1fr_auto_1fr_130px_90px] text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-5 py-3 gap-3 min-w-[560px]">
                  <span className="text-center">Rnd</span>
                  <span className="text-right">Home</span>
                  <span className="text-center">Score</span>
                  <span>Away</span>
                  <span>Date</span>
                  <span>Status</span>
                </div>

                <div className="divide-y divide-bb-border/60">
                  {matches.map((m) => {
                    const isHome      = m.homeTeamId === team.id
                    const isCompleted = m.status === 'COMPLETED'
                    const isLive      = m.status === 'LIVE'
                    const homeWon     = isCompleted && (m.homeScore ?? 0) > (m.awayScore ?? 0)
                    const awayWon     = isCompleted && (m.awayScore ?? 0) > (m.homeScore ?? 0)
                    const myWon       = isHome ? homeWon : awayWon

                    return (
                      <div
                        key={m.id}
                        className={`grid grid-cols-[48px_1fr_auto_1fr_130px_90px] items-center px-5 py-3.5 gap-3 min-w-[560px] ${
                          isLive ? 'bg-bb-crimson/5' : myWon ? 'bg-bb-gold/[0.03]' : ''
                        }`}
                      >
                        {/* Round */}
                        <div className="text-center">
                          <span className="text-xs font-heading font-bold text-bb-gold/70 border border-bb-gold/20 px-1.5 py-0.5 rounded-sm">
                            {m.round}
                          </span>
                        </div>

                        {/* Home team */}
                        <div className="text-right min-w-0">
                          <span className={`font-heading font-bold text-sm truncate block ${
                            m.homeTeamId === team.id
                              ? 'text-bb-gold'
                              : homeWon ? 'text-white' : 'text-white/70'
                          }`}>
                            {m.homeTeam.name}
                          </span>
                        </div>

                        {/* Score / vs */}
                        <div className="text-center min-w-[64px]">
                          {isCompleted ? (
                            <span className="font-heading font-black text-lg text-bb-gold tabular-nums">
                              {m.homeScore} – {m.awayScore}
                            </span>
                          ) : isLive ? (
                            <span className="font-heading font-black text-sm text-bb-crimson-bright animate-pulse">LIVE</span>
                          ) : (
                            <span className="text-bb-muted/40 text-xs font-heading tracking-widest uppercase">vs</span>
                          )}
                        </div>

                        {/* Away team */}
                        <div className="min-w-0">
                          <span className={`font-heading font-bold text-sm truncate block ${
                            m.awayTeamId === team.id
                              ? 'text-bb-gold'
                              : awayWon ? 'text-white' : 'text-white/70'
                          }`}>
                            {m.awayTeam.name}
                          </span>
                        </div>

                        {/* Date */}
                        <div>
                          {m.scheduledAt ? (
                            <>
                              <span className="text-xs text-white/70 block">{format(m.scheduledAt, 'EEE d MMM')}</span>
                              <span className="text-[11px] text-bb-muted/50">{format(m.scheduledAt, 'HH:mm')}</span>
                            </>
                          ) : (
                            <span className="text-xs text-bb-muted/40 italic">TBD</span>
                          )}
                        </div>

                        {/* Status */}
                        <div>
                          <span className={`text-[10px] font-heading tracking-wider uppercase px-1.5 py-0.5 rounded-sm border ${MATCH_STATUS_CLS[m.status]}`}>
                            {MATCH_STATUS_LABEL[m.status]}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
        )}

        {/* ══ TAB: STANDING ════════════════════════════════════════════════════ */}
        {tab === 'standing' && (
          <section>
            {/* Context note */}
            <p className="text-xs text-bb-muted/50 mb-5">
              {team.division
                ? <>Standings within <span className="text-bb-muted">{team.division.name}</span> · {team.league.name}</>
                : <>Overall standings for <span className="text-bb-muted">{team.league.name}</span></>
              }
              {' '}· W={pointsWin} D={pointsDraw} L={pointsLoss} pts
            </p>

            {sortedStanding.length === 0 ? (
              <div className="bg-bb-dark border border-bb-border rounded-sm p-10 text-center">
                <p className="text-bb-muted text-sm italic">No teams to show.</p>
              </div>
            ) : (
              <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-x-auto shadow-lg shadow-black/40">
                {/* Header */}
                <div className="grid grid-cols-[36px_1fr_140px_60px_36px_36px_36px_52px] text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-5 py-3 gap-2 min-w-[560px]">
                  <span className="text-center">#</span>
                  <span>Team</span>
                  <span>Coach</span>
                  <span className="text-right" title="Team Value in thousands">TV</span>
                  <span className="text-center">W</span>
                  <span className="text-center">D</span>
                  <span className="text-center">L</span>
                  <span className="text-center">Pts</span>
                </div>

                <div className="divide-y divide-bb-border/60">
                  {sortedStanding.map((t, i) => {
                    const tPts    = t.wins * pointsWin + t.draws * pointsDraw + t.losses * pointsLoss
                    const isMe    = t.id === team.id
                    const isFirst = i === 0

                    return (
                      <div
                        key={t.id}
                        className={`grid grid-cols-[36px_1fr_140px_60px_36px_36px_36px_52px] items-center px-5 py-3.5 gap-2 min-w-[560px] ${
                          isMe ? 'bg-bb-gold/8 border-l-2 border-bb-gold' : isFirst ? '' : ''
                        }`}
                      >
                        <div className="text-center">
                          <RankMedal rank={i + 1} />
                        </div>

                        <span className={`font-heading font-bold text-sm truncate ${
                          isMe ? 'text-bb-gold' : isFirst ? 'text-white' : 'text-white/80'
                        }`}>
                          {t.name}
                          {isMe && (
                            <span className="ml-2 text-[10px] font-normal text-bb-gold/60 normal-case tracking-normal">← you</span>
                          )}
                        </span>

                        <span className="text-xs text-bb-muted truncate">{t.coach.alias ?? t.coach.name}</span>

                        <span className="text-right font-heading font-bold text-sm text-bb-gold/80 tabular-nums" title="Team Value">
                          {t.teamValue.toLocaleString()}
                          <span className="text-bb-muted/50 font-normal text-xs ml-0.5">k</span>
                        </span>

                        <span className="text-center text-sm font-semibold text-green-400 tabular-nums">{t.wins}</span>
                        <span className="text-center text-sm text-bb-muted tabular-nums">{t.draws}</span>
                        <span className="text-center text-sm text-bb-crimson-bright tabular-nums">{t.losses}</span>
                        <span className={`text-center font-heading font-black text-base tabular-nums ${
                          isMe || isFirst ? 'text-bb-gold' : 'text-bb-gold/60'
                        }`}>
                          {tPts}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {myRank > 0 && (
              <p className="text-xs text-bb-muted/40 mt-3 text-right">
                {team.name} is ranked <span className="text-bb-gold">{myRank}</span> of {sortedStanding.length}
              </p>
            )}
          </section>
        )}

        {/* ══ TAB: HONOURS ════════════════════════════════════════════════════ */}
        {tab === 'achievements' && (() => {
          // Top players from living roster (cumulative career stats on this team)
          const byTd  = [...living].sort((a, b) => b.touchdowns    - a.touchdowns)
          const byCp  = [...living].sort((a, b) => b.completePasses - a.completePasses)
          const byCas = [...living].sort((a, b) => b.casualties     - a.casualties)
          const topScorer   = byTd[0]
          const topThrower  = byCp[0]
          const topCasualty = byCas[0]

          function RankBadge({ rank }: { rank: number }) {
            if (rank === 1) return (
              <svg viewBox="0 0 24 24" className="w-10 h-10" fill="none">
                <path d="M12 2L14.5 8.5H21L15.5 12.5L17.5 19L12 15.5L6.5 19L8.5 12.5L3 8.5H9.5L12 2Z" fill="#FFD700" stroke="#B8860B" strokeWidth="0.5"/>
                <circle cx="12" cy="11" r="3" fill="#B8860B" opacity="0.6"/>
                <path d="M10.5 10.5C10.5 10.5 11 9 12 9C13 9 13.5 10.5 13.5 10.5" stroke="#FFD700" strokeWidth="0.8" strokeLinecap="round"/>
                <circle cx="11" cy="11.5" r="0.7" fill="#FFD700"/>
                <circle cx="13" cy="11.5" r="0.7" fill="#FFD700"/>
                <path d="M10.5 13C10.5 13 11.2 14 12 14C12.8 14 13.5 13 13.5 13" stroke="#FFD700" strokeWidth="0.8" strokeLinecap="round"/>
              </svg>
            )
            if (rank === 2) return (
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none">
                <path d="M4 8h3V5h10v3h3v5c0 2-1.5 3.5-3 4l-1 3H8l-1-3C5.5 16.5 4 15 4 13V8Z" fill="#C0C0C0" stroke="#888" strokeWidth="0.5"/>
                <path d="M4 8h3v5H4V8ZM17 8h3v5h-3V8Z" fill="#A0A0A0"/>
                <rect x="8" y="20" width="8" height="2" rx="0.5" fill="#888"/>
              </svg>
            )
            if (rank === 3) return (
              <svg viewBox="0 0 24 24" className="w-9 h-9" fill="none">
                <path d="M4 8h3V5h10v3h3v5c0 2-1.5 3.5-3 4l-1 3H8l-1-3C5.5 16.5 4 15 4 13V8Z" fill="#CD7F32" stroke="#8B4513" strokeWidth="0.5"/>
                <path d="M4 8h3v5H4V8ZM17 8h3v5h-3V8Z" fill="#A0632A"/>
                <rect x="8" y="20" width="8" height="2" rx="0.5" fill="#8B4513"/>
              </svg>
            )
            return (
              <div className="w-9 h-9 flex items-center justify-center font-heading font-black text-bb-muted text-2xl">
                {rank}
              </div>
            )
          }

          function playerLabel(p: typeof living[0] | undefined) {
            if (!p) return '—'
            return p.name?.trim() || p.playerType.name
          }

          const rankLabel = myRank === 1 ? '1st' : myRank === 2 ? '2nd' : myRank === 3 ? '3rd' : `${myRank}th`
          const rankColor = myRank === 1 ? 'text-bb-gold' : myRank === 2 ? 'text-slate-300' : myRank === 3 ? 'text-amber-600' : 'text-white'
          const totalMatches = team.wins + team.draws + team.losses

          return (
            <div className="space-y-10">

              {/* ── League Standing ───────────────────────────── */}
              <section>
                <SectionRule title="League Standing" right={team.division?.name ?? team.league.name} />

                {sortedStanding.length === 0 ? (
                  <p className="text-bb-muted text-sm italic">No league data available.</p>
                ) : (
                  <div className="bg-bb-dark border border-bb-border rounded-sm overflow-hidden">
                    {/* This team's rank highlight */}
                    <div className={`flex items-center gap-5 px-6 py-5 border-b ${myRank <= 3 ? 'border-bb-gold/30 bg-bb-gold/5' : 'border-bb-border'}`}>
                      <RankBadge rank={myRank} />
                      <div className="flex-1 min-w-0">
                        <div className={`font-heading font-black text-2xl tracking-widest uppercase ${rankColor}`}>
                          {rankLabel} Place
                        </div>
                        <div className="text-bb-muted text-sm mt-0.5">
                          {team.wins}W · {team.draws}D · {team.losses}L
                          {totalMatches > 0 && (
                            <span className="ml-2 text-bb-muted/50">· {totalMatches} {totalMatches === 1 ? 'match' : 'matches'} played</span>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-heading font-black text-3xl tabular-nums ${rankColor}`}>
                          {team.wins * pointsWin + team.draws * pointsDraw + team.losses * pointsLoss}
                        </div>
                        <div className="text-bb-muted text-xs uppercase tracking-widest">pts</div>
                      </div>
                    </div>

                    {/* Mini standings table */}
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-bb-border/50">
                          <th className="px-4 py-2 text-left text-bb-muted/60 font-medium uppercase tracking-widest w-8">#</th>
                          <th className="px-4 py-2 text-left text-bb-muted/60 font-medium uppercase tracking-widest">Team</th>
                          <th className="px-3 py-2 text-center text-bb-muted/60 font-medium uppercase tracking-widest w-8">W</th>
                          <th className="px-3 py-2 text-center text-bb-muted/60 font-medium uppercase tracking-widest w-8">D</th>
                          <th className="px-3 py-2 text-center text-bb-muted/60 font-medium uppercase tracking-widest w-8">L</th>
                          <th className="px-3 py-2 text-right text-bb-muted/60 font-medium uppercase tracking-widest w-12">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortedStanding.map((t, i) => {
                          const rank = i + 1
                          const pts  = t.wins * pointsWin + t.draws * pointsDraw + t.losses * pointsLoss
                          const isMe = t.id === team.id
                          return (
                            <tr key={t.id}
                              className={`border-b border-bb-border/30 last:border-0 transition-colors ${
                                isMe ? 'bg-bb-gold/5 text-bb-gold' : 'text-bb-muted hover:text-white'
                              }`}
                            >
                              <td className="px-4 py-2.5 font-heading font-bold">
                                {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
                              </td>
                              <td className="px-4 py-2.5 font-medium">{t.name}</td>
                              <td className="px-3 py-2.5 text-center tabular-nums">{t.wins}</td>
                              <td className="px-3 py-2.5 text-center tabular-nums">{t.draws}</td>
                              <td className="px-3 py-2.5 text-center tabular-nums">{t.losses}</td>
                              <td className="px-3 py-2.5 text-right tabular-nums font-heading font-bold">{pts}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* ── Player Honours ───────────────────────────────── */}
              <section>
                <SectionRule title="Player Honours" />
                {living.length === 0 ? (
                  <p className="text-bb-muted text-sm italic">No players on the roster yet.</p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                    {/* Top Scorer */}
                    <div className="bg-bb-dark border border-bb-border rounded-sm p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        {/* Football / touchdown icon */}
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-bb-gold" fill="currentColor">
                          <ellipse cx="12" cy="12" rx="9" ry="6" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                          <line x1="3" y1="12" x2="21" y2="12" stroke="currentColor" strokeWidth="1"/>
                          <line x1="12" y1="6" x2="12" y2="18" stroke="currentColor" strokeWidth="1"/>
                          <line x1="8" y1="8.5" x2="8" y2="15.5" stroke="currentColor" strokeWidth="0.8"/>
                          <line x1="16" y1="8.5" x2="16" y2="15.5" stroke="currentColor" strokeWidth="0.8"/>
                        </svg>
                        <span className="text-bb-muted text-xs uppercase tracking-widest font-heading">Top Scorer</span>
                      </div>
                      {topScorer && topScorer.touchdowns > 0 ? (
                        <>
                          <div className="font-heading font-black text-white text-lg leading-tight">
                            #{topScorer.number} {playerLabel(topScorer)}
                          </div>
                          <div className="text-bb-muted text-xs">{topScorer.playerType.name}</div>
                          <div className="font-heading font-black text-bb-gold text-3xl tabular-nums">
                            {topScorer.touchdowns}
                            <span className="text-bb-muted text-sm font-normal ml-1">TD</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-bb-muted/40 text-sm italic">No touchdowns yet</div>
                      )}
                    </div>

                    {/* Top Thrower */}
                    <div className="bg-bb-dark border border-bb-border rounded-sm p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        {/* Pass/throw arc icon */}
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-bb-gold" fill="none" stroke="currentColor" strokeWidth="1.5">
                          <path d="M5 19C5 19 9 5 19 5" strokeLinecap="round"/>
                          <path d="M19 5L14 6M19 5L18 10" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        <span className="text-bb-muted text-xs uppercase tracking-widest font-heading">Top Thrower</span>
                      </div>
                      {topThrower && topThrower.completePasses > 0 ? (
                        <>
                          <div className="font-heading font-black text-white text-lg leading-tight">
                            #{topThrower.number} {playerLabel(topThrower)}
                          </div>
                          <div className="text-bb-muted text-xs">{topThrower.playerType.name}</div>
                          <div className="font-heading font-black text-bb-gold text-3xl tabular-nums">
                            {topThrower.completePasses}
                            <span className="text-bb-muted text-sm font-normal ml-1">Completions</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-bb-muted/40 text-sm italic">No completions yet</div>
                      )}
                    </div>

                    {/* Top Casualty */}
                    <div className="bg-bb-dark border border-bb-border rounded-sm p-5 space-y-3">
                      <div className="flex items-center gap-2">
                        {/* Skull icon */}
                        <svg viewBox="0 0 24 24" className="w-6 h-6 text-bb-gold" fill="currentColor">
                          <path d="M12 3C7.58 3 4 6.58 4 11C4 13.5 5.1 15.7 6.8 17.2L7 21H17L17.2 17.2C18.9 15.7 20 13.5 20 11C20 6.58 16.42 3 12 3ZM9 17H8V14H9V17ZM9.5 12.5C8.67 12.5 8 11.83 8 11C8 10.17 8.67 9.5 9.5 9.5C10.33 9.5 11 10.17 11 11C11 11.83 10.33 12.5 9.5 12.5ZM16 17H15V14H16V17ZM14.5 12.5C13.67 12.5 13 11.83 13 11C13 10.17 13.67 9.5 14.5 9.5C15.33 9.5 16 10.17 16 11C16 11.83 15.33 12.5 14.5 12.5Z"/>
                        </svg>
                        <span className="text-bb-muted text-xs uppercase tracking-widest font-heading">Top Casualty</span>
                      </div>
                      {topCasualty && topCasualty.casualties > 0 ? (
                        <>
                          <div className="font-heading font-black text-white text-lg leading-tight">
                            #{topCasualty.number} {playerLabel(topCasualty)}
                          </div>
                          <div className="text-bb-muted text-xs">{topCasualty.playerType.name}</div>
                          <div className="font-heading font-black text-bb-gold text-3xl tabular-nums">
                            {topCasualty.casualties}
                            <span className="text-bb-muted text-sm font-normal ml-1">Cas</span>
                          </div>
                        </>
                      ) : (
                        <div className="text-bb-muted/40 text-sm italic">No casualties yet</div>
                      )}
                    </div>

                  </div>
                )}
              </section>

            </div>
          )
        })()}

        {/* ══ TAB: TEAM NEWS ═══════════════════════════════════════════════════ */}
        {tab === 'news' && (
          <section className="space-y-8">

            {/* New post form (owner only) */}
            {isOwner && (
              <div>
                <SectionRule title="Post News" />
                <form action={createTeamNewsPost} className="bg-bb-dark border border-bb-border rounded-sm p-5 space-y-3">
                  <input type="hidden" name="teamId" value={team.id} />
                  <div>
                    <input
                      name="title"
                      type="text"
                      required
                      placeholder="Headline…"
                      maxLength={120}
                      className="w-full bg-bb-darker border border-bb-border text-white font-heading font-bold text-base px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/30"
                    />
                  </div>
                  <div>
                    <textarea
                      name="body"
                      required
                      placeholder="Write your match report, announcement, or update…"
                      rows={5}
                      className="w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 resize-y placeholder:text-bb-muted/30"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit"
                      className="text-xs font-heading font-bold uppercase tracking-widest px-5 py-2 rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 transition-colors">
                      Publish
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Posts feed */}
            <div>
              {!isOwner && <SectionRule title="Team News" />}
              {teamNews.length === 0 ? (
                <div className="bg-bb-dark border border-bb-border rounded-sm p-10 text-center">
                  <p className="text-bb-muted/50 text-sm italic">No news posted yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {teamNews.map((post) => (
                    <article key={post.id} className="bg-bb-dark border border-bb-border rounded-sm p-5">
                      <div className="flex items-start justify-between gap-4 mb-1">
                        <h3 className="font-heading font-bold text-white text-base leading-snug">{post.title}</h3>
                        <span className="text-bb-muted/50 text-xs whitespace-nowrap shrink-0 mt-0.5">
                          {format(post.createdAt, 'd MMM yyyy · HH:mm')}
                        </span>
                      </div>
                      <p className="text-[11px] text-bb-gold/60 font-heading tracking-wider uppercase mb-3">
                        {post.author.alias ?? post.author.name}
                      </p>
                      <p className="text-sm text-bb-muted leading-relaxed whitespace-pre-wrap">{post.body}</p>

                      {post.coachNote && (
                        <div className="mt-4 pt-3 border-t border-bb-border/40">
                          <p className="text-[10px] text-bb-muted/50 uppercase tracking-widest mb-1">Coach&apos;s Note</p>
                          <p className="text-sm text-white/70 italic">{post.coachNote}</p>
                        </div>
                      )}

                      {isOwner && (
                        <form action={appendTeamNewsNote} className="mt-4 pt-3 border-t border-bb-border/40 flex gap-2 items-end">
                          <input type="hidden" name="postId" value={post.id} />
                          <textarea name="note" defaultValue={post.coachNote} placeholder="Add a private coach note…" rows={2}
                            className="flex-1 bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 resize-none placeholder:text-bb-muted/30" />
                          <button type="submit"
                            className="text-xs font-medium uppercase tracking-widest px-3 py-2 rounded-sm border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted transition-colors self-end">
                            Save Note
                          </button>
                        </form>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>

          </section>
        )}

      </div>
    </div>
  )
}
