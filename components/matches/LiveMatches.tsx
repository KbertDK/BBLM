'use client'

import Link from 'next/link'
import { useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { MatchSummary } from '@/lib/types'
import LiveBadge from '@/components/ui/LiveBadge'

const EVENT_ICON: Record<string, string> = {
  TD:           '🏈',
  CASUALTY:     '💀',
  INTERCEPTION: '🖐',
  HALFTIME:     '⛔',
}

interface Props {
  matches: MatchSummary[]
}

export default function LiveMatches({ matches }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Auto-refresh every 10 minutes
  useEffect(() => {
    const id = setInterval(() => {
      startTransition(() => { router.refresh() })
    }, 10 * 60 * 1000)
    return () => clearInterval(id)
  }, [router])

  function handleRefresh() {
    startTransition(() => { router.refresh() })
  }

  return (
    <div className="flex flex-col gap-3">
      <h3 className="font-heading text-xs tracking-widest uppercase text-bb-crimson-bright/80 mb-1 border-b border-bb-crimson/30 pb-2 flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          On The Pitch
          <LiveBadge />
        </span>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          title="Refresh live scores"
          className="inline-flex items-center gap-1 text-[10px] px-2 py-1 border border-bb-crimson/30 text-bb-muted hover:text-bb-crimson-bright hover:border-bb-crimson/60 rounded-sm transition-colors disabled:opacity-40 font-heading tracking-widest uppercase"
        >
          {isPending ? (
            <span className="animate-spin inline-block">↻</span>
          ) : (
            '↻'
          )}
          Update
        </button>
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
            {/* Score */}
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 text-center">
                <div className="text-white font-semibold text-sm mb-1 truncate">{m.homeTeamName}</div>
                <div className="font-heading text-3xl font-black text-bb-gold">
                  {m.homeScore ?? 0}
                </div>
              </div>
              <div className="shrink-0 text-center">
                <div className="text-bb-muted text-xs uppercase tracking-widest">vs</div>
              </div>
              <div className="flex-1 text-center">
                <div className="text-white font-semibold text-sm mb-1 truncate">{m.awayTeamName}</div>
                <div className="font-heading text-3xl font-black text-bb-gold">
                  {m.awayScore ?? 0}
                </div>
              </div>
            </div>

            {/* Recent events */}
            {m.recentEvents && m.recentEvents.length > 0 && (
              <div className="mt-3 pt-3 border-t border-bb-crimson/20 space-y-1">
                {m.recentEvents.map((ev) => (
                  <div key={ev.id} className="flex items-start gap-1.5 text-[11px] text-bb-muted leading-snug">
                    <span className="shrink-0 text-xs">{EVENT_ICON[ev.type] ?? '•'}</span>
                    <span className="line-clamp-1">{ev.label}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Footer */}
            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-bb-muted">Round {m.round}</span>
              <Link
                href={`/matches/${m.id}/game`}
                target="_blank"
                className="inline-flex items-center gap-1.5 text-[11px] font-heading uppercase tracking-widest px-3 py-1 border border-bb-crimson/50 text-bb-crimson hover:bg-bb-crimson hover:text-white rounded-sm transition-colors"
              >
                ⚔ Game On
              </Link>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
