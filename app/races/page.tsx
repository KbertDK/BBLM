import Link from 'next/link'
import { getAllRaces } from '@/lib/queries/races'
import SectionHeading from '@/components/ui/SectionHeading'
import { getRaceLogo } from '@/lib/race-logo'
import clsx from 'clsx'

type Props = { searchParams: Promise<{ tier?: string }> }

const sourceColors: Record<string, string> = {
  'CRP/LRB6 core':  'text-bb-gold   border-bb-gold/30   bg-bb-gold/5',
  'LRB6/NAF extra': 'text-blue-400  border-blue-400/30  bg-blue-400/5',
  '3DB':            'text-purple-400 border-purple-400/30 bg-purple-400/5',
}

const tierStyle: Record<string, string> = {
  '1':   'text-bb-gold           border-bb-gold/40           bg-bb-gold/10',
  '1.5': 'text-blue-400          border-blue-400/40          bg-blue-400/10',
  '2':   'text-amber-400         border-amber-400/40         bg-amber-400/10',
  '3':   'text-bb-crimson-bright border-bb-crimson-bright/40 bg-bb-crimson/10',
}

const tierLabel: Record<string, string> = {
  '1':   'Tier 1',
  '1.5': 'Tier 1.5',
  '2':   'Tier 2',
  '3':   'Tier 3',
}

const TIERS = ['1', '1.5', '2', '3']

export default async function RacesPage({ searchParams }: Props) {
  const { tier } = await searchParams
  const allRaces  = await getAllRaces()
  const races     = tier ? allRaces.filter((r) => r.tier === tier) : allRaces

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <SectionHeading
          title="Races"
          subtitle={
            tier
              ? `${races.length} of ${allRaces.length} races · ${tierLabel[tier] ?? `Tier ${tier}`}`
              : `${allRaces.length} races available this season`
          }
        />

        {/* ── Tier filter pills ─────────────────────────────────────── */}
        <div className="mb-6">
          <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/40 mb-2">Tier</p>
          <div className="flex flex-wrap gap-2">
            <Link
              href="/races"
              className={clsx(
                'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
                !tier
                  ? 'bg-bb-gold text-bb-navy border-bb-gold font-bold'
                  : 'border-bb-border/50 text-bb-muted hover:border-bb-gold/30 hover:text-bb-gold/70',
              )}
            >
              All
            </Link>
            {TIERS.map((t) => (
              <Link
                key={t}
                href={`/races?tier=${t}`}
                className={clsx(
                  'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors font-bold',
                  tier === t
                    ? tierStyle[t]
                    : 'border-bb-border/50 text-bb-muted hover:border-bb-gold/30 hover:text-bb-gold/70',
                )}
              >
                T{t}
              </Link>
            ))}
          </div>
          {tier && allRaces.find((r) => r.tier === tier) && (
            <p className="text-[11px] text-bb-muted/50 italic mt-2 ml-0.5">
              {allRaces.find((r) => r.tier === tier)?.tierDescription}
            </p>
          )}
        </div>

        {/* ── Race table ────────────────────────────────────────────── */}
        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
          <div className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr] text-xs font-heading tracking-widest uppercase text-bb-muted/60 bg-bb-darker border-b border-bb-border px-5 py-3 gap-3">
            <span>Race</span>
            <span className="text-center">Tier</span>
            <span>Roster Source</span>
            <span className="text-right">Re-Roll</span>
            <span className="text-center">Apothecary</span>
            <span className="text-center">Teams</span>
          </div>

          {races.length === 0 && (
            <p className="text-bb-muted/50 text-sm italic px-5 py-6">No races in this tier.</p>
          )}

          {races.map((race) => {
            const sourceStyle = sourceColors[race.rosterSource] ?? 'text-bb-muted border-bb-muted/30 bg-bb-muted/5'
            const ts = tierStyle[race.tier] ?? 'text-bb-muted border-bb-muted/30 bg-bb-muted/5'
            return (
              <Link
                key={race.id}
                href={`/races/${race.id}`}
                className="grid grid-cols-[2fr_1fr_2fr_1fr_1fr_1fr] items-center px-5 py-3.5 gap-3 border-b border-bb-border last:border-0 hover:bg-bb-gold/5 transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {(() => { const logo = getRaceLogo(race.name); return logo ? <img src={logo} alt="" className="w-8 h-8 object-contain shrink-0" /> : null })()}
                  <span className="font-heading font-bold text-sm text-white group-hover:text-bb-gold transition-colors truncate">
                    {race.name}
                  </span>
                </div>

                <div className="flex justify-center">
                  <span
                    className={`text-xs font-heading font-bold px-2 py-0.5 rounded-sm border ${ts}`}
                    title={race.tierDescription ?? undefined}
                  >
                    T{race.tier}
                  </span>
                </div>

                <div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-sm border ${sourceStyle}`}>
                    {race.rosterSource}
                  </span>
                </div>

                <div className="text-right text-sm text-bb-muted font-mono">
                  {race.rerollPrice.toLocaleString()} gp
                </div>

                <div className="text-center">
                  {race.hasApothecary ? (
                    <span className="text-green-400 text-xs font-semibold">Yes</span>
                  ) : (
                    <span className="text-bb-crimson-bright text-xs font-semibold">No</span>
                  )}
                </div>

                <div className="text-center text-sm text-bb-muted">
                  {race.teamCount > 0 ? race.teamCount : '—'}
                </div>
              </Link>
            )
          })}
        </div>

        {/* Legend */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-6 text-xs text-bb-muted">
          <div className="flex gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-bb-gold/20 border border-bb-gold/30" />
              CRP/LRB6 core
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-blue-400/10 border border-blue-400/30" />
              LRB6/NAF extra
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-sm bg-purple-400/10 border border-purple-400/30" />
              3DB
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
