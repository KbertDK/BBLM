import Link from 'next/link'
import { TeamSummary } from '@/lib/types'
import SectionHeading from '@/components/ui/SectionHeading'
import TeamCard from './TeamCard'

interface Props {
  teams: TeamSummary[]
}

export default function TeamQuickAccess({ teams }: Props) {
  return (
    <section>
      <SectionHeading
        title="Your Dugout"
        subtitle="Demo Mode — coach login coming in Phase 2"
      />
      <div className="flex flex-col items-center gap-8">
        <Link
          href="/teams/new"
          className="inline-flex items-center gap-3 px-8 py-4 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-sm rounded-sm border border-bb-crimson-bright/50 hover:border-bb-crimson-bright transition-all shadow-lg shadow-bb-crimson/20 hover:shadow-bb-crimson/40"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Recruit a New Team
        </Link>

        {teams.length > 0 && (
          <div className="w-full">
            <p className="text-bb-muted text-xs uppercase tracking-widest text-center mb-4">
              — or open an existing team —
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {teams.map((team) => (
                <TeamCard key={team.id} team={team} />
              ))}
            </div>
          </div>
        )}

        {teams.length === 0 && (
          <p className="text-bb-muted text-sm italic text-center">
            No teams yet. Recruit your first squad to get started!
          </p>
        )}
      </div>
    </section>
  )
}
