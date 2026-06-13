import { MatchSummary } from '@/lib/types'
import LiveBadge from '@/components/ui/LiveBadge'

interface Props {
  matches: MatchSummary[]
}

export default function LiveMatches({ matches }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-xs tracking-widest uppercase text-bb-crimson-bright/80 mb-1 border-b border-bb-crimson/30 pb-2 flex items-center gap-2">
        On The Pitch
        <LiveBadge />
      </h3>
      {matches.length === 0 ? (
        <div className="text-center py-6">
          <div className="w-3 h-3 rounded-full bg-bb-muted/30 mx-auto mb-3 animate-pulse" />
          <p className="text-bb-muted text-sm italic">No matches in progress.</p>
        </div>
      ) : (
        matches.map((m) => (
          <div
            key={m.id}
            className="rounded-sm p-4 border border-bb-crimson/40 bg-bb-crimson/5 hover:bg-bb-crimson/10 transition-colors"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center">
                <div className="text-white font-semibold text-sm mb-1">{m.homeTeamName}</div>
                <div className="font-heading text-3xl font-black text-bb-gold">
                  {m.homeScore ?? 0}
                </div>
              </div>
              <div className="shrink-0 text-center">
                <div className="text-bb-muted text-xs uppercase tracking-widest">vs</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-white font-semibold text-sm mb-1">{m.awayTeamName}</div>
                <div className="font-heading text-3xl font-black text-bb-gold">
                  {m.awayScore ?? 0}
                </div>
              </div>
            </div>
            <div className="mt-2 text-center">
              <span className="text-xs text-bb-muted">Round {m.round}</span>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
