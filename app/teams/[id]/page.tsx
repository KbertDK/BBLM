import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getTeamById } from '@/lib/queries/teams'
import { getSession } from '@/lib/auth'
import { updatePlayer } from './actions'

export const dynamic = 'force-dynamic'

interface Props {
  params:       { id: string }
  searchParams?: { err?: string }
}

const CAT_COLOR: Record<string, string> = {
  G: 'text-blue-300   border-blue-300/30   bg-blue-300/5',
  A: 'text-green-300  border-green-300/30  bg-green-300/5',
  P: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/5',
  S: 'text-red-300    border-red-300/30    bg-red-300/5',
  M: 'text-purple-300 border-purple-300/30 bg-purple-300/5',
  E: 'text-bb-crimson-bright border-bb-crimson-bright/30 bg-bb-crimson/5',
}

const STATUS_CLS: Record<string, string> = {
  ACTIVE: 'text-green-400        border-green-700/50   bg-green-900/10',
  MNG:    'text-amber-400        border-amber-700/50   bg-amber-900/10',
  DEAD:   'text-bb-crimson-bright border-bb-crimson/50  bg-bb-crimson/5',
}

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: 'Active',
  MNG:    'MNG',
  DEAD:   'R.I.P.',
}

const editBase = 'bg-transparent border border-transparent hover:border-bb-border/60 focus:border-bb-gold/40 rounded-sm outline-none transition-colors placeholder:text-bb-muted/30 text-sm'

function StatCell({ value, muted = false }: { value: number; muted?: boolean }) {
  return (
    <td className={`px-2 py-3.5 text-center font-heading font-bold text-sm tabular-nums ${muted ? 'text-bb-muted/60' : 'text-white'}`}>
      {value}
    </td>
  )
}

export default async function TeamPage({ params, searchParams }: Props) {
  const [team, session] = await Promise.all([getTeamById(params.id), getSession()])
  if (!team) notFound()

  const isOwner    = session?.coachId === team.coachId
  const maxSlots   = team.league.ruleSet?.numberOfPlayers ?? 16
  const living     = team.players.filter((p) => p.status !== 'DEAD')
  const deadHeroes = team.players.filter((p) => p.status === 'DEAD')
  const emptyCount = Math.max(0, maxSlots - living.length)
  const pts        = team.wins * 3 + team.draws
  const coachName  = team.coach.alias ?? team.coach.name

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
        <div className="mb-10">
          <h1 className="font-heading text-4xl font-black text-bb-gold tracking-widest uppercase mb-3">
            {team.name}
          </h1>

          <div className="flex flex-wrap gap-2 mb-5 text-xs">
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

        {/* Duplicate number error */}
        {searchParams?.err === 'dup_number' && (
          <div className="mb-6 px-4 py-3 bg-amber-900/20 border border-amber-700/40 rounded-sm text-amber-300 text-sm">
            That jersey number is already taken — choose a different one.
          </div>
        )}

        {/*
          Per-row forms rendered outside the table.
          Each form carries the playerId hidden input; the visible inputs and
          save button in the table rows reference these forms via the `form` attribute.
        */}
        {isOwner && living.map((player) => (
          <form key={player.id} id={`pf-${player.id}`} action={updatePlayer}>
            <input type="hidden" name="playerId" value={player.id} />
          </form>
        ))}

        {/* ── Roster ── */}
        <section className="mb-14">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase">Roster</h2>
            <div className="flex-1 h-px bg-bb-border" />
            <span className="text-bb-muted/50 text-xs tabular-nums">{living.length} / {maxSlots} slots</span>
          </div>

          <div className="overflow-x-auto rounded-sm">
            <table className="w-full min-w-[820px] bg-bb-dark border border-bb-gold/20 shadow-xl shadow-black/50">
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
                  <th className="px-3 py-3 text-center w-24">Status</th>
                  {isOwner && <th className="px-2 py-3 w-12" />}
                </tr>
              </thead>
              <tbody className="divide-y divide-bb-border/50">

                {living.map((player, i) => (
                  <tr
                    key={player.id}
                    className={player.status === 'MNG' ? 'bg-amber-900/5' : i % 2 !== 0 ? 'bg-white/[0.02]' : ''}
                  >
                    {/* Jersey number — editable for owner */}
                    <td className="px-2 py-2 text-center w-16">
                      {isOwner ? (
                        <input
                          form={`pf-${player.id}`}
                          name="number"
                          type="number"
                          min={1}
                          max={99}
                          defaultValue={player.number}
                          className={`${editBase} font-heading font-bold text-bb-gold text-center tabular-nums w-14 px-1.5 py-1`}
                        />
                      ) : (
                        <span className="font-heading font-bold text-bb-gold text-sm tabular-nums">{player.number}</span>
                      )}
                    </td>

                    {/* Player name — editable for owner */}
                    <td className="px-2 py-2">
                      {isOwner ? (
                        <input
                          form={`pf-${player.id}`}
                          name="name"
                          type="text"
                          defaultValue={player.name ?? ''}
                          placeholder="Unnamed"
                          maxLength={40}
                          className={`${editBase} text-white font-medium w-full min-w-[8rem] px-2 py-1`}
                        />
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
                            <span
                              key={s.name}
                              title={s.skillRule}
                              className={`text-xs px-1.5 py-0.5 rounded-sm border cursor-help ${CAT_COLOR[s.category] ?? ''}`}
                            >
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
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-sm border ${STATUS_CLS[player.status]}`}>
                        {STATUS_LABEL[player.status]}
                      </span>
                    </td>

                    {/* Save button — owner only */}
                    {isOwner && (
                      <td className="px-2 py-2 text-center">
                        <button
                          form={`pf-${player.id}`}
                          type="submit"
                          title="Save changes"
                          className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-bb-border/60 text-bb-muted/60 hover:border-bb-gold hover:text-bb-gold transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {/* Empty slots */}
                {Array.from({ length: emptyCount }, (_, i) => (
                  <tr key={`empty-${i}`} className="opacity-25">
                    <td className="px-3 py-3 text-center font-heading text-bb-muted/50 text-sm tabular-nums">
                      {living.length + i + 1}
                    </td>
                    <td className="px-3 py-3 text-xs text-bb-muted/40 italic">Empty slot</td>
                    <td className="px-3 py-3 text-bb-muted/30 text-xs">—</td>
                    <td colSpan={9} />
                    <td />
                    {isOwner && <td />}
                  </tr>
                ))}

              </tbody>
            </table>
          </div>
        </section>

        {/* ── Fallen Heroes ── */}
        {deadHeroes.length > 0 && (
          <section>
            <div className="flex items-center gap-4 mb-4">
              <h2 className="font-heading text-lg font-bold text-bb-crimson-bright/70 tracking-widest uppercase">
                Fallen Heroes
              </h2>
              <div className="flex-1 h-px bg-bb-crimson/20" />
              <span className="text-bb-muted/50 text-xs">{deadHeroes.length}</span>
            </div>

            <div className="overflow-x-auto rounded-sm">
              <table className="w-full min-w-[820px] bg-bb-dark border border-bb-crimson/20 shadow-xl shadow-black/50">
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
                    <th className="px-3 py-3 text-center w-24">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-bb-crimson/10">
                  {deadHeroes.map((player, i) => (
                    <tr key={player.id} className={`opacity-55 ${i % 2 !== 0 ? 'bg-white/[0.01]' : ''}`}>
                      <td className="px-3 py-3.5 text-center font-heading font-bold text-bb-muted text-sm tabular-nums">
                        {player.number}
                      </td>
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
                            <span
                              key={s.name}
                              title={s.skillRule}
                              className={`text-xs px-1.5 py-0.5 rounded-sm border cursor-help ${CAT_COLOR[s.category] ?? ''}`}
                            >
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.completePasses}</td>
                      <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.touchdowns}</td>
                      <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.interceptions}</td>
                      <td className="px-2 py-3.5 text-center text-sm text-bb-muted/60 tabular-nums">{player.casualties}</td>
                      <td className="px-3 py-3.5 text-center">
                        <span className={`inline-block text-xs px-2 py-0.5 rounded-sm border ${STATUS_CLS['DEAD']}`}>
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

      </div>
    </div>
  )
}
