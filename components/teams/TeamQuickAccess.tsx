import Link from 'next/link'
import { TeamSummary } from '@/lib/types'
import SectionHeading from '@/components/ui/SectionHeading'
import TeamCard from './TeamCard'

interface Props {
  teams: TeamSummary[] | null  // null = not logged in
}

export default function TeamQuickAccess({ teams }: Props) {
  return (
    <section>
      <SectionHeading
        title="Your Dugout"
        subtitle="Every legend started with a handshake and a bag of gold."
      />

      {/* Not logged in */}
      {teams === null && (
        <div className="text-center space-y-4">
          <p className="text-bb-muted text-sm max-w-sm mx-auto leading-relaxed">
            The crowd chants your name, but the gates are still locked.
            Sign in to claim your teams and return to the gridiron.
          </p>
          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 px-6 py-3 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-sm rounded-sm border border-bb-crimson-bright/50 transition-all shadow-lg shadow-bb-crimson/20 hover:shadow-bb-crimson/40"
          >
            Coach Login
          </Link>
        </div>
      )}

      {/* Logged in */}
      {teams !== null && (
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
                — your teams —
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
              Your dugout is empty. Time to build a dynasty.
            </p>
          )}
        </div>
      )}
    </section>
  )
}
