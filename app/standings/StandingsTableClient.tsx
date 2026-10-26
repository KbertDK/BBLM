'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'

export interface TeamRowClient {
  id: string
  name: string
  race: string
  coachName: string
  wins: number
  draws: number
  losses: number
  teamValue: number
  divisionId: string | null
  eloRating: number
  tdsScored: number
  tdsConceded: number
  tdsDiff: number
}

type SortKey = 'pts' | 'wins' | 'draws' | 'losses' | 'td_diff' | 'elo' | 'tv' | 'name' | null

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="font-heading font-black text-bb-gold text-base">1</span>
  if (rank === 2) return <span className="font-heading font-bold text-slate-300 text-sm">2</span>
  if (rank === 3) return <span className="font-heading font-bold text-amber-700 text-sm">3</span>
  return <span className="font-heading text-sm text-bb-muted/40">{rank}</span>
}

function SortIndicator({ active, dir }: { active: boolean; dir: 'asc' | 'desc' }) {
  if (!active) return <span className="opacity-20 ml-0.5">↕</span>
  return <span className="text-bb-gold ml-0.5">{dir === 'desc' ? '↓' : '↑'}</span>
}

export default function StandingsTableClient({
  teams: initialTeams,
  pointsWin,
  pointsDraw,
  pointsLoss,
}: {
  teams: TeamRowClient[]
  pointsWin: number
  pointsDraw: number
  pointsLoss: number
}) {
  const [sortKey, setSortKey] = useState<SortKey>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      // Natural ascending for losses (fewest is better) and name (A–Z)
      setSortDir(key === 'name' || key === 'losses' ? 'asc' : 'desc')
    }
  }

  const pts = (t: TeamRowClient) => t.wins * pointsWin + t.draws * pointsDraw + t.losses * pointsLoss

  const sorted = [...initialTeams].sort((a, b) => {
    if (!sortKey) return 0 // keep server-provided order

    if (sortKey === 'name') {
      return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    }

    const valA =
      sortKey === 'pts'     ? pts(a)
      : sortKey === 'wins'    ? a.wins
      : sortKey === 'draws'   ? a.draws
      : sortKey === 'losses'  ? a.losses
      : sortKey === 'td_diff' ? a.tdsDiff
      : sortKey === 'elo'     ? a.eloRating
      : /* tv */                a.teamValue

    const valB =
      sortKey === 'pts'     ? pts(b)
      : sortKey === 'wins'    ? b.wins
      : sortKey === 'draws'   ? b.draws
      : sortKey === 'losses'  ? b.losses
      : sortKey === 'td_diff' ? b.tdsDiff
      : sortKey === 'elo'     ? b.eloRating
      : /* tv */                b.teamValue

    return sortDir === 'desc' ? valB - valA : valA - valB
  })

  const COLS = 'grid-cols-[32px_1fr_140px_72px_64px_32px_32px_32px_52px_48px_56px]'

  function ColBtn({
    label, sortK, align = 'left',
  }: {
    label: string; sortK: SortKey; align?: 'left' | 'center' | 'right'
  }) {
    const active = sortKey === sortK
    return (
      <button
        type="button"
        onClick={() => handleSort(sortK)}
        className={clsx(
          'flex items-center transition-colors hover:text-bb-gold/80 select-none',
          align === 'center' && 'justify-center',
          align === 'right'  && 'justify-end',
          active ? 'text-bb-gold' : '',
        )}
      >
        {label}<SortIndicator active={active} dir={sortDir} />
      </button>
    )
  }

  return (
    <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-x-auto">
      <div className={`grid ${COLS} text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-4 py-2.5 gap-2 min-w-[720px]`}>
        <span className="text-center">#</span>
        <ColBtn label="Team"  sortK="name" />
        <span>Coach</span>
        <span>Race</span>
        <ColBtn label="TV"    sortK="tv"      align="right" />
        <ColBtn label="W"     sortK="wins"    align="center" />
        <ColBtn label="D"     sortK="draws"   align="center" />
        <ColBtn label="L"     sortK="losses"  align="center" />
        <ColBtn label="TD±"   sortK="td_diff" align="center" />
        <ColBtn label="Pts"   sortK="pts"     align="center" />
        <ColBtn label="ELO"   sortK="elo"     align="center" />
      </div>

      {sorted.length === 0 && (
        <p className="text-bb-muted/50 text-sm italic px-4 py-4">No teams.</p>
      )}

      {sorted.map((team, i) => {
        const teamPts = pts(team)
        const isFirst = i === 0
        return (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className={clsx(
              `grid ${COLS} items-center px-4 py-3 gap-2 border-b border-bb-border/60 last:border-0 transition-colors group min-w-[720px]`,
              isFirst ? 'hover:bg-bb-gold/8' : 'hover:bg-bb-gold/5',
            )}
          >
            <div className="text-center"><RankMedal rank={i + 1} /></div>
            <div className="min-w-0">
              <span className={clsx(
                'font-heading font-bold text-sm leading-tight block truncate transition-colors group-hover:text-bb-gold',
                isFirst ? 'text-white' : 'text-white/85',
              )}>
                {team.name}
              </span>
            </div>
            <span className="text-xs text-bb-muted truncate">{team.coachName}</span>
            <span className="text-xs text-bb-muted/60 truncate">{team.race}</span>
            <span className="text-right font-heading font-bold text-sm text-bb-gold/80 tabular-nums" title="Team Value">
              {team.teamValue.toLocaleString()}
              <span className="text-bb-muted/50 font-normal text-xs ml-0.5">k</span>
            </span>
            <span className="text-center text-sm font-semibold text-green-400">{team.wins}</span>
            <span className="text-center text-sm text-bb-muted">{team.draws}</span>
            <span className="text-center text-sm text-bb-crimson-bright">{team.losses}</span>
            <span className={clsx(
              'text-center text-xs font-heading font-bold tabular-nums',
              team.tdsDiff > 0 ? 'text-green-400/80' : team.tdsDiff < 0 ? 'text-bb-crimson-bright/80' : 'text-bb-muted/50',
            )}>
              {team.tdsDiff > 0 ? '+' : ''}{team.tdsDiff}
            </span>
            <span className={clsx(
              'text-center font-heading font-black text-base',
              isFirst ? 'text-bb-gold' : 'text-bb-gold/70',
            )}>
              {teamPts}
            </span>
            <span className="text-center text-xs font-heading font-bold text-bb-gold/60 tabular-nums">
              {Math.round(team.eloRating)}
            </span>
          </Link>
        )
      })}
    </div>
  )
}
