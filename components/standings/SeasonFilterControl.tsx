'use client'

import { useRouter } from 'next/navigation'
import clsx from 'clsx'
import type { SeasonFilterOption } from '@/lib/seasonFilter'

interface Props {
  leagueId?: string
  options:   SeasonFilterOption[]
  current:   string // 'active' | 'closed' | <seasonId>, default 'active'
}

export default function SeasonFilterControl({ leagueId, options, current }: Props) {
  const router = useRouter()

  function go(season: string) {
    const params = new URLSearchParams()
    if (leagueId) params.set('leagueId', leagueId)
    params.set('season', season)
    router.push(`/?${params.toString()}`)
  }

  const ongoing = options.filter((o) => o.status === 'ACTIVE' || o.status === 'READY')
  const ended   = options.filter((o) => o.status === 'ENDED')
  const isSpecificSeason = current !== 'active' && current !== 'closed'

  return (
    <div className="flex flex-wrap items-center gap-2 mb-4">
      <button
        onClick={() => go('active')}
        className={clsx(
          'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
          current === 'active'
            ? 'bg-bb-gold text-bb-navy border-bb-gold font-bold'
            : 'border-bb-border text-bb-muted hover:border-bb-gold/40 hover:text-bb-gold',
        )}
      >
        Active Season
      </button>
      <button
        onClick={() => go('closed')}
        className={clsx(
          'px-3 py-1.5 text-xs font-heading tracking-wider uppercase rounded-sm border transition-colors',
          current === 'closed'
            ? 'bg-bb-gold text-bb-navy border-bb-gold font-bold'
            : 'border-bb-border text-bb-muted hover:border-bb-gold/40 hover:text-bb-gold',
        )}
      >
        All Closed
      </button>
      {options.length > 0 && (
        <select
          value={isSpecificSeason ? current : ''}
          onChange={(e) => { if (e.target.value) go(e.target.value) }}
          className={clsx(
            'bg-bb-dark/50 border text-xs font-heading uppercase tracking-widest rounded-sm px-3 py-1.5 focus:outline-none cursor-pointer',
            isSpecificSeason ? 'border-bb-gold/50 text-bb-gold' : 'border-bb-border text-bb-muted',
          )}
        >
          <option value="">— Pick a specific season —</option>
          {ongoing.length > 0 && (
            <optgroup label="Current">
              {ongoing.map((o) => (
                <option key={o.id} value={o.id}>{o.leagueName} · {o.name}</option>
              ))}
            </optgroup>
          )}
          {ended.length > 0 && (
            <optgroup label="Ended">
              {ended.map((o) => (
                <option key={o.id} value={o.id}>{o.leagueName} · {o.name}</option>
              ))}
            </optgroup>
          )}
        </select>
      )}
    </div>
  )
}
