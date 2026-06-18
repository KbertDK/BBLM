'use client'

import { useRouter } from 'next/navigation'

interface League { id: string; name: string; season: number }

export default function LeagueFilter({
  leagues,
  activeId,
}: {
  leagues: League[]
  activeId?: string
}) {
  const router = useRouter()
  return (
    <select
      value={activeId ?? ''}
      onChange={(e) => {
        const v = e.target.value
        router.push(v ? `/?leagueId=${v}` : '/')
      }}
      className="bg-bb-gold/5 border border-bb-gold/30 text-bb-gold text-xs font-heading uppercase tracking-widest rounded-sm px-4 py-1.5 focus:outline-none focus:border-bb-gold/60 hover:bg-bb-gold/10 transition-colors cursor-pointer"
    >
      <option value="">All leagues</option>
      {leagues.map((l) => (
        <option key={l.id} value={l.id}>{l.name} · S{l.season}</option>
      ))}
    </select>
  )
}
