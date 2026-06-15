import { notFound } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { getTeamById } from '@/lib/queries/teams'
import { getSession } from '@/lib/auth'
import { updatePlayer, updateTeamInfo, deleteTeam, deactivateTeam, activateTeam, assignTeam,
         buyPlayer, sackPlayer, reinstatePlayer, appendTeamNewsNote, createTeamNewsPost } from './actions'
import { getRaceLogo } from '@/lib/race-logo'
import prisma from '@/lib/prisma'
import { getTeamNews } from '@/lib/queries/news'

export const dynamic = 'force-dynamic'

interface Props {
  params:       { id: string }
  searchParams?: { err?: string; tab?: string }
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
  const tab = searchParams?.tab ?? 'roster'

  const [team, session] = await Promise.all([getTeamById(params.id), getSession()])
  if (!team) notFound()

  const isOwner  = session?.coachId === team.coachId
  const raceLogo = getRaceLogo(team.race.name)
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

  if (tab === 'roster') {
    playerTypes = await prisma.playerType.findMany({
      where:   { raceId: team.raceId },
      orderBy: { cost: 'asc' },
      select:  { id: true, name: true, cost: true, maxCount: true },
    })
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

  if (tab === 'standing') {
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
        <div className="mb-8 flex items-start gap-8">
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

          {raceLogo && (
            <img
              src={raceLogo}
              alt={team.race.name}
              className="w-44 h-44 object-contain shrink-0 hidden sm:block opacity-90"
            />
          )}
        </div>

        {/* ── Tab navigation ── */}
        <nav className="flex gap-1.5 mb-8 border-b border-bb-border pb-0">
          {(['roster', 'schedule', 'standing', 'news'] as const).map((t) => {
            const labels = { roster: 'Roster', schedule: 'Schedule', standing: 'Standing', news: 'Team News' }
            return (
              <Link
                key={t}
                href={`/teams/${team.id}?tab=${t}${t === 'roster' && searchParams?.err ? `&err=${searchParams.err}` : ''}`}
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
            {searchParams?.err === 'dup_number' && (
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

              {isOwner ? (
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

                    <div className="bg-bb-darker rounded-sm p-3 space-y-1">
                      <label className="text-bb-muted text-xs uppercase tracking-widest block">Re-Rolls (max 8)</label>
                      <input name="rerolls" type="number" min={0} max={8} defaultValue={team.rerolls}
                        className="font-heading font-black text-white text-xl tabular-nums bg-transparent outline-none w-full focus:text-bb-gold transition-colors" />
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-1">
                      <label className="text-bb-muted text-xs uppercase tracking-widest block">Asst. Coaches</label>
                      <input name="assistantCoaches" type="number" min={0} defaultValue={team.assistantCoaches}
                        className="font-heading font-black text-white text-xl tabular-nums bg-transparent outline-none w-full focus:text-bb-gold transition-colors" />
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-1">
                      <label className="text-bb-muted text-xs uppercase tracking-widest block">Cheerleaders</label>
                      <input name="cheerleaders" type="number" min={0} defaultValue={team.cheerleaders}
                        className="font-heading font-black text-white text-xl tabular-nums bg-transparent outline-none w-full focus:text-bb-gold transition-colors" />
                    </div>

                    <div className="bg-bb-darker rounded-sm p-3 space-y-1">
                      <label className="text-bb-muted text-xs uppercase tracking-widest block">Fan Factor</label>
                      <input name="fanFactor" type="number" min={0} defaultValue={team.fanFactor}
                        className="font-heading font-black text-white text-xl tabular-nums bg-transparent outline-none w-full focus:text-bb-gold transition-colors" />
                    </div>

                    {team.race.hasApothecary ? (
                      <div className="bg-bb-darker rounded-sm p-3 space-y-2">
                        <div className="text-bb-muted text-xs uppercase tracking-widest">Apothecary</div>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input type="hidden" name="apothecary" value="false" />
                          <input type="checkbox" name="apothecary" value="true" defaultChecked={team.apothecary} className="accent-bb-gold w-4 h-4" />
                          <span className={`font-heading font-black text-xl ${team.apothecary ? 'text-green-400' : 'text-bb-muted/50'}`}>
                            {team.apothecary ? 'Yes' : 'No'}
                          </span>
                        </label>
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
                        <StatCell value={player.playerType.ma} />
                        <StatCell value={player.playerType.st} />
                        <StatCell value={player.playerType.ag} />
                        <StatCell value={player.playerType.av} />
                        <td className="px-3 py-3.5">
                          <div className="flex flex-wrap gap-1">
                            {player.playerType.startingSkills.length === 0 ? (
                              <span className="text-bb-muted/30 text-xs">—</span>
                            ) : (
                              player.playerType.startingSkills.map((s) => (
                                <span key={s.name} title={s.skillRule} className={`text-xs px-1.5 py-0.5 rounded-sm border cursor-help ${CAT_COLOR[s.category] ?? ''}`}>
                                  {s.name}
                                </span>
                              ))
                            )}
                          </div>
                        </td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.completePasses}</td>
                        <td className="px-2 py-3.5 text-center text-sm font-bold text-bb-gold tabular-nums">{player.touchdowns}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.interceptions}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.casualties}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.mvp}</td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-muted tabular-nums">{player.ssp}</td>
                        <td className="px-3 py-3.5 text-xs text-bb-crimson-bright">
                          {player.niggling || <span className="text-bb-muted/30">—</span>}
                        </td>
                        <td className="px-2 py-3.5 text-center text-sm text-bb-gold tabular-nums font-mono">
                          {(player.value > 0 ? player.value : player.playerType.cost).toLocaleString()}
                        </td>
                        <td className="px-3 py-3.5 text-center">
                          <span className={`inline-block text-xs px-2 py-0.5 rounded-sm border ${PLAYER_STATUS_CLS[player.status]}`}>
                            {PLAYER_STATUS_LABEL[player.status]}
                          </span>
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
                                <button type="submit" title="Sack player"
                                  className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-bb-border/60 text-bb-muted/60 hover:border-amber-600 hover:text-amber-400 transition-colors">
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
                        <td />
                        {isOwner ? (
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
            {isOwner && emptyCount > 0 && (
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
                          className="bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 min-w-[260px]">
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
                                  <button type="submit"
                                    className="text-xs font-medium uppercase tracking-widest px-3 py-1 rounded-sm border border-amber-700/50 text-amber-400 hover:bg-amber-900/20 transition-colors">
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
                          <StatCell value={player.playerType.ma} muted />
                          <StatCell value={player.playerType.st} muted />
                          <StatCell value={player.playerType.ag} muted />
                          <StatCell value={player.playerType.av} muted />
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
                          <td className="px-3 py-3.5 text-xs text-bb-muted/60">{player.niggling || '—'}</td>
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
              <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-lg shadow-black/40">
                {/* Header */}
                <div className="grid grid-cols-[48px_1fr_auto_1fr_130px_90px] text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-5 py-3 gap-3">
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
                        className={`grid grid-cols-[48px_1fr_auto_1fr_130px_90px] items-center px-5 py-3.5 gap-3 ${
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
              <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-lg shadow-black/40">
                {/* Header */}
                <div className="grid grid-cols-[36px_1fr_140px_60px_36px_36px_36px_52px] text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-5 py-3 gap-2">
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
                        className={`grid grid-cols-[36px_1fr_140px_60px_36px_36px_36px_52px] items-center px-5 py-3.5 gap-2 ${
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
