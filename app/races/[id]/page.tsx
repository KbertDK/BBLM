import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getRaceById } from '@/lib/queries/races'
import { getRaceLogo } from '@/lib/race-logo'

export const revalidate = 300

interface Props {
  params: { id: string }
}

const categoryLabel: Record<string, string> = {
  G: 'General',
  A: 'Agility',
  P: 'Passing',
  S: 'Strength',
  M: 'Mutation',
  E: 'Extraordinary',
}

const tierStyle: Record<string, string> = {
  '1':   'text-bb-gold      border-bb-gold/40      bg-bb-gold/10',
  '1.5': 'text-blue-400     border-blue-400/40     bg-blue-400/10',
  '2':   'text-amber-400    border-amber-400/40    bg-amber-400/10',
  '3':   'text-bb-crimson-bright border-bb-crimson-bright/40 bg-bb-crimson/10',
}

const categoryColor: Record<string, string> = {
  G: 'text-blue-300   border-blue-300/30   bg-blue-300/5',
  A: 'text-green-300  border-green-300/30  bg-green-300/5',
  P: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/5',
  S: 'text-red-300    border-red-300/30    bg-red-300/5',
  M: 'text-purple-300 border-purple-300/30 bg-purple-300/5',
  E: 'text-bb-crimson-bright border-bb-crimson-bright/30 bg-bb-crimson/5',
}

export default async function RaceDetailPage({ params }: Props) {
  const race = await getRaceById(params.id)
  if (!race) notFound()

  const raceLogo = getRaceLogo(race.name)

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <Link href="/races" className="inline-flex items-center gap-1.5 text-bb-muted text-xs uppercase tracking-widest hover:text-bb-gold transition-colors mb-8">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          All Races
        </Link>

        {/* Race header */}
        <div className="mb-10">
          <div className="flex items-center gap-5 mb-4">
            {raceLogo && (
              <img src={raceLogo} alt={race.name} className="w-20 h-20 object-contain shrink-0" />
            )}
            <h1 className="font-heading text-4xl font-black text-bb-gold tracking-widest uppercase">
              {race.name}
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-bb-dark border border-bb-border rounded-sm px-4 py-3">
              <div className="text-bb-muted text-xs uppercase tracking-widest mb-0.5">Roster Source</div>
              <div className="text-white font-semibold text-sm">{race.rosterSource}</div>
            </div>
            <div className="bg-bb-dark border border-bb-border rounded-sm px-4 py-3">
              <div className="text-bb-muted text-xs uppercase tracking-widest mb-0.5">Re-Roll Price</div>
              <div className="text-bb-gold font-heading font-bold">{race.rerollPrice.toLocaleString()} gp</div>
            </div>
            <div className="bg-bb-dark border border-bb-border rounded-sm px-4 py-3">
              <div className="text-bb-muted text-xs uppercase tracking-widest mb-0.5">Apothecary</div>
              <div className={race.hasApothecary ? 'text-green-400 font-semibold text-sm' : 'text-bb-crimson-bright font-semibold text-sm'}>
                {race.hasApothecary ? 'Yes' : 'No'}
              </div>
            </div>
            {/* Tier */}
            <div className="bg-bb-dark border border-bb-border rounded-sm px-4 py-3">
              <div className="text-bb-muted text-xs uppercase tracking-widest mb-1">Tier</div>
              <span className={`text-sm font-heading font-bold px-2 py-0.5 rounded-sm border ${tierStyle[race.tier] ?? 'text-bb-muted border-bb-muted/30 bg-bb-muted/5'}`}>
                Tier {race.tier}
              </span>
            </div>

            {race.teamCount > 0 && (
              <div className="bg-bb-dark border border-bb-border rounded-sm px-4 py-3">
                <div className="text-bb-muted text-xs uppercase tracking-widest mb-0.5">Teams in League</div>
                <div className="text-white font-semibold text-sm">{race.teamCount}</div>
              </div>
            )}
          </div>
          {race.tierDescription && (
            <p className="mt-4 text-sm text-bb-muted/70 italic border-l-2 border-bb-gold/30 pl-3">
              {race.tierDescription}
            </p>
          )}

          <div className="mt-5">
            <Link
              href={`/teams/new?raceId=${race.id}`}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-xs rounded-sm border border-bb-crimson-bright/50 transition-all shadow-lg shadow-bb-crimson/20"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create team with this race
            </Link>
          </div>
        </div>

        {/* Player Types */}
        <div className="mb-12">
          <div className="flex items-center gap-4 mb-4">
            <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase">Player Types</h2>
            <div className="flex-1 h-px bg-bb-border" />
          </div>

          {race.playerTypes.length === 0 ? (
            <div className="bg-bb-dark border border-bb-border rounded-sm px-6 py-10 text-center">
              <p className="text-bb-muted italic text-sm">No player types added yet for this race.</p>
              <p className="text-bb-muted/40 text-xs mt-1">Player type masterdata will appear here automatically once loaded.</p>
            </div>
          ) : (
            <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
              <div className="grid grid-cols-[repeat(14,minmax(0,1fr))] text-xs font-heading tracking-widest uppercase text-bb-muted/60 bg-bb-darker border-b border-bb-border px-4 py-3 gap-2">
                <span className="col-span-3">Position</span>
                <span className="col-span-1 text-center">Qty</span>
                <span className="col-span-1 text-right">Cost</span>
                <span className="col-span-1 text-center">MA</span>
                <span className="col-span-1 text-center">ST</span>
                <span className="col-span-1 text-center">AG</span>
                <span className="col-span-1 text-center">AV</span>
                <span className="col-span-1 text-center text-green-300/60">Normal</span>
                <span className="col-span-1 text-center text-yellow-300/60">Double</span>
                <span className="col-span-3">Starting Skills</span>
              </div>
              {race.playerTypes.map((pt, i) => (
                <div key={pt.id} className={`grid grid-cols-[repeat(14,minmax(0,1fr))] items-start px-4 py-3.5 gap-2 border-b border-bb-border last:border-0 ${i % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}>
                  <span className="col-span-3 font-semibold text-sm text-white">{pt.name}</span>
                  <span className="col-span-1 text-center text-sm text-bb-muted">0–{pt.maxCount}</span>
                  <span className="col-span-1 text-right text-sm text-bb-gold font-mono">{pt.cost.toLocaleString()}</span>
                  <span className="col-span-1 text-center font-bold text-sm text-white">{pt.ma}</span>
                  <span className="col-span-1 text-center font-bold text-sm text-white">{pt.st}</span>
                  <span className="col-span-1 text-center font-bold text-sm text-white">{pt.ag}</span>
                  <span className="col-span-1 text-center font-bold text-sm text-white">{pt.av}</span>
                  <span className="col-span-1 text-center font-mono text-xs text-green-300">{pt.skillRollNormal}</span>
                  <span className="col-span-1 text-center font-mono text-xs text-yellow-300">{pt.skillRollDouble}</span>
                  <div className="col-span-3 flex flex-wrap gap-1">
                    {pt.startingSkills.length === 0 ? (
                      <span className="text-bb-muted/40 text-xs italic">—</span>
                    ) : (
                      pt.startingSkills.map((s) => (
                        <span key={s.id} title={s.skillRule} className={`text-xs px-1.5 py-0.5 rounded-sm border cursor-help ${categoryColor[s.category] ?? ''}`}>
                          {s.name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Skill legend */}
        {race.playerTypes.length > 0 && (
          <div className="flex flex-wrap gap-3 text-xs text-bb-muted mb-12">
            {Object.entries(categoryLabel).map(([k, v]) => (
              <span key={k} className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border ${categoryColor[k]}`}>
                <span className="font-bold">{k}</span> {v}
              </span>
            ))}
            <span className="text-bb-muted/50 italic ml-1">· hover a skill badge to see its rule</span>
          </div>
        )}

      </div>
    </div>
  )
}
