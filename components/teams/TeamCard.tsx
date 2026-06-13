import Link from 'next/link'
import { TeamSummary } from '@/lib/types'
import GrimdarkCard from '@/components/ui/GrimdarkCard'

interface Props {
  team: TeamSummary
}

export default function TeamCard({ team }: Props) {
  return (
    <Link href={`/teams/${team.id}`} className="block group">
      <GrimdarkCard className="p-4 group-hover:border-bb-gold/50 transition-colors">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="font-heading text-base font-bold text-white group-hover:text-bb-gold transition-colors truncate">
              {team.name}
            </div>
            <div className="text-bb-muted text-xs mt-0.5 tracking-wide">{team.race}</div>
          </div>
          <svg className="w-4 h-4 text-bb-muted group-hover:text-bb-gold transition-colors mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
        <div className="mt-3 flex gap-3 text-xs font-medium">
          <span className="text-green-400">W {team.wins}</span>
          <span className="text-bb-muted">D {team.draws}</span>
          <span className="text-bb-crimson-bright">L {team.losses}</span>
        </div>
      </GrimdarkCard>
    </Link>
  )
}
