import Link from 'next/link'
import { getAllRaces } from '@/lib/queries/races'
import SectionHeading from '@/components/ui/SectionHeading'
import { getRaceLogo } from '@/lib/race-logo'

export const revalidate = 3600

const sourceColors: Record<string, string> = {
  'CRP/LRB6 core':  'text-bb-gold   border-bb-gold/30   bg-bb-gold/5',
  'LRB6/NAF extra': 'text-blue-400  border-blue-400/30  bg-blue-400/5',
  '3DB':            'text-purple-400 border-purple-400/30 bg-purple-400/5',
}

export default async function RacesPage() {
  const races = await getAllRaces()

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <SectionHeading
          title="Races"
          subtitle={`${races.length} races available this season`}
        />

        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50">
          <div className="grid grid-cols-12 text-xs font-heading tracking-widest uppercase text-bb-muted/60 bg-bb-darker border-b border-bb-border px-5 py-3 gap-3">
            <span className="col-span-4">Race</span>
            <span className="col-span-3">Roster Source</span>
            <span className="col-span-2 text-right">Re-Roll</span>
            <span className="col-span-2 text-center">Apothecary</span>
            <span className="col-span-1 text-center">Teams</span>
          </div>

          {races.map((race) => {
            const sourceStyle = sourceColors[race.rosterSource] ?? 'text-bb-muted border-bb-muted/30 bg-bb-muted/5'
            return (
              <Link
                key={race.id}
                href={`/races/${race.id}`}
                className="grid grid-cols-12 items-center px-5 py-3.5 gap-3 border-b border-bb-border last:border-0 hover:bg-bb-gold/5 transition-colors group"
              >
                <div className="col-span-4 flex items-center gap-2.5">
                  {(() => { const logo = getRaceLogo(race.name); return logo ? <img src={logo} alt="" className="w-8 h-8 object-contain shrink-0" /> : null })()}
                  <span className="font-heading font-bold text-sm text-white group-hover:text-bb-gold transition-colors min-w-0 truncate">
                    {race.name}
                  </span>
                </div>
                <div className="col-span-3">
                  <span className={`text-xs px-1.5 py-0.5 rounded-sm border ${sourceStyle}`}>
                    {race.rosterSource}
                  </span>
                </div>
                <div className="col-span-2 text-right text-sm text-bb-muted font-mono">
                  {race.rerollPrice.toLocaleString()} gp
                </div>
                <div className="col-span-2 text-center">
                  {race.hasApothecary ? (
                    <span className="text-green-400 text-xs font-semibold">Yes</span>
                  ) : (
                    <span className="text-bb-crimson-bright text-xs font-semibold">No</span>
                  )}
                </div>
                <div className="col-span-1 text-center text-sm text-bb-muted">
                  {race.teamCount > 0 ? race.teamCount : '—'}
                </div>
              </Link>
            )
          })}
        </div>

        <div className="flex gap-4 mt-6 text-xs text-bb-muted">
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
  )
}
