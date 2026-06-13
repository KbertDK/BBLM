import { format } from 'date-fns'
import { MatchResult } from '@/lib/types'
import clsx from 'clsx'

interface Props {
  results: MatchResult[]
}

export default function LatestResults({ results }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-xs tracking-widest uppercase text-bb-gold/70 mb-1 border-b border-bb-border pb-2">
        Latest Results
      </h3>
      {results.length === 0 ? (
        <p className="text-bb-muted text-sm italic">No results yet.</p>
      ) : (
        results.map((m) => {
          const homeWon = m.winnerId === m.homeTeamId
          const awayWon = m.winnerId === m.awayTeamId

          return (
            <div key={m.id} className="bg-bb-darker rounded-sm p-3 border border-bb-border hover:border-bb-gold/30 transition-colors">
              <div className="text-xs text-bb-muted mb-2">
                Round {m.round} · {format(new Date(m.scheduledAt), 'd MMM')}
              </div>
              <div className="flex items-center gap-2">
                <span className={clsx('flex-1 text-sm font-medium truncate', homeWon ? 'text-bb-gold' : 'text-bb-muted')}>
                  {m.homeTeamName}
                </span>
                <span className="font-heading text-lg font-black text-bb-gold shrink-0 tracking-wider">
                  {m.homeScore} – {m.awayScore}
                </span>
                <span className={clsx('flex-1 text-sm font-medium truncate text-right', awayWon ? 'text-bb-gold' : 'text-bb-muted')}>
                  {m.awayTeamName}
                </span>
              </div>
              {m.winnerId ? (
                <div className="text-xs text-bb-gold/60 mt-1 text-center">
                  {homeWon ? m.homeTeamName : m.awayTeamName} wins
                </div>
              ) : (
                <div className="text-xs text-bb-muted mt-1 text-center">Draw</div>
              )}
            </div>
          )
        })
      )}
    </div>
  )
}
