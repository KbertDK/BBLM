import { format } from 'date-fns'
import { MatchSummary } from '@/lib/types'

interface Props {
  matches: MatchSummary[]
}

export default function UpcomingMatches({ matches }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-xs tracking-widest uppercase text-bb-gold/70 mb-1 border-b border-bb-border pb-2">
        Upcoming Fixtures
      </h3>
      {matches.length === 0 ? (
        <p className="text-bb-muted text-sm italic">No upcoming fixtures scheduled.</p>
      ) : (
        matches.map((m) => (
          <div key={m.id} className="bg-bb-darker rounded-sm p-3 border border-bb-border hover:border-bb-gold/30 transition-colors">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs text-bb-gold/60 border border-bb-gold/20 px-1.5 py-0.5 rounded-sm font-heading tracking-wider">
                Round {m.round}
              </span>
              <span className="text-xs text-bb-muted">
                {format(new Date(m.scheduledAt), 'EEE d MMM · HH:mm')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2 text-sm">
              <span className="text-white font-medium truncate">{m.homeTeamName}</span>
              <span className="text-bb-muted shrink-0 text-xs">vs</span>
              <span className="text-white font-medium truncate text-right">{m.awayTeamName}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
