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
  coachEloRating: number
  tdsScored: number
  tdsConceded: number
  tdsDiff: number
  streakWin: number
  streakLoss: number
  streakDraw: number
  wonPrizes: number
  tcasf: number
  tcasa: number
}

type SortKey =
  | 'pts' | 'wins' | 'losses' | 'draws'
  | 'team_elo' | 'coach_elo'
  | 'tv' | 'name'
  | 'streak_win' | 'streak_loss' | 'streak_draw'
  | 'gp' | 'win_pct'
  | 'gf' | 'ga' | 'prizes'
  | 'tcasf' | 'tcasa'
  | 'sdiff' | 'tcdiff'
  | null

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

function Diff({ val }: { val: number }) {
  return (
    <span className={clsx(
      'tabular-nums',
      val > 0 ? 'text-green-400/80' : val < 0 ? 'text-bb-crimson-bright/80' : 'text-bb-muted/50',
    )}>
      {val > 0 ? '+' : ''}{val}
    </span>
  )
}

const GRID = 'grid-cols-[26px_minmax(72px,1fr)_38px_66px_38px_50px_38px_24px_24px_24px_28px_28px_28px_28px_36px_24px_24px_26px_30px_32px_32px_34px_34px]'
const MIN_W = 'min-w-[980px]'

const ASCE_DEFAULT = new Set<SortKey>(['name', 'losses', 'ga'])

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
      setSortDir(ASCE_DEFAULT.has(key) ? 'asc' : 'desc')
    }
  }

  const pts    = (t: TeamRowClient) => t.wins * pointsWin + t.draws * pointsDraw + t.losses * pointsLoss
  const gp     = (t: TeamRowClient) => t.wins + t.draws + t.losses
  const winPct = (t: TeamRowClient) => { const g = gp(t); return g > 0 ? t.wins / g * 100 : 0 }
  const tcdiff = (t: TeamRowClient) => t.tcasf - t.tcasa

  const sorted = [...initialTeams].sort((a, b) => {
    if (!sortKey) return 0

    if (sortKey === 'name') {
      return sortDir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
    }

    const v = (t: TeamRowClient): number => {
      switch (sortKey) {
        case 'pts':         return pts(t)
        case 'wins':        return t.wins
        case 'losses':      return t.losses
        case 'draws':       return t.draws
        case 'team_elo':    return t.eloRating
        case 'coach_elo':   return t.coachEloRating
        case 'tv':          return t.teamValue
        case 'streak_win':  return t.streakWin
        case 'streak_loss': return t.streakLoss
        case 'streak_draw': return t.streakDraw
        case 'gp':          return gp(t)
        case 'win_pct':     return winPct(t)
        case 'gf':          return t.tdsScored
        case 'ga':          return t.tdsConceded
        case 'prizes':      return t.wonPrizes
        case 'tcasf':       return t.tcasf
        case 'tcasa':       return t.tcasa
        case 'sdiff':       return t.tdsDiff
        case 'tcdiff':      return tcdiff(t)
        default:            return 0
      }
    }

    return sortDir === 'desc' ? v(b) - v(a) : v(a) - v(b)
  })

  function ColBtn({
    label, sortK, align = 'left', title: titleAttr,
  }: {
    label: string; sortK: SortKey; align?: 'left' | 'center' | 'right'; title?: string
  }) {
    const active = sortKey === sortK
    return (
      <button
        type="button"
        onClick={() => handleSort(sortK)}
        title={titleAttr}
        className={clsx(
          'flex items-center transition-colors hover:text-bb-gold/80 select-none w-full',
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
      <div className={`grid ${GRID} text-[9px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-3 py-2 gap-1 ${MIN_W}`}>
        <span className="text-center">#</span>
        <ColBtn label="Team"  sortK="name" />
        <ColBtn label="T.ELO" sortK="team_elo"    align="center" title="Team ELO Rating" />
        <span className="truncate">Coach</span>
        <ColBtn label="C.ELO" sortK="coach_elo"   align="center" title="Coach ELO Rating" />
        <span>Race</span>
        <ColBtn label="TV"    sortK="tv"           align="right"  title="Team Value (thousands)" />
        <ColBtn label="W"     sortK="wins"         align="center" title="Wins" />
        <ColBtn label="L"     sortK="losses"       align="center" title="Losses" />
        <ColBtn label="D"     sortK="draws"        align="center" title="Draws" />
        <ColBtn label="SW"    sortK="streak_win"   align="center" title="Longest Win Streak" />
        <ColBtn label="SL"    sortK="streak_loss"  align="center" title="Longest Loss Streak" />
        <ColBtn label="SD"    sortK="streak_draw"  align="center" title="Longest Draw Streak" />
        <ColBtn label="GP"    sortK="gp"           align="center" title="Games Played" />
        <ColBtn label="WIN%"  sortK="win_pct"      align="center" title="Win Percentage" />
        <ColBtn label="GF"    sortK="gf"           align="center" title="Goals For (TDs Scored)" />
        <ColBtn label="GA"    sortK="ga"           align="center" title="Goals Against (TDs Conceded)" />
        <ColBtn label="WT"    sortK="prizes"       align="center" title="Won Team Prizes" />
        <ColBtn label="PTS"   sortK="pts"          align="center" title="Points" />
        <ColBtn label="CsF"   sortK="tcasf"        align="center" title="Casualties For" />
        <ColBtn label="CsA"   sortK="tcasa"        align="center" title="Casualties Against" />
        <ColBtn label="s±"    sortK="sdiff"        align="center" title="Score Difference (GF−GA)" />
        <ColBtn label="Cs±"   sortK="tcdiff"       align="center" title="Casualty Difference (CsF−CsA)" />
      </div>

      {sorted.length === 0 && (
        <p className="text-bb-muted/50 text-sm italic px-4 py-4">No teams.</p>
      )}

      {sorted.map((team, i) => {
        const teamPts    = pts(team)
        const teamGp     = gp(team)
        const teamWinPct = winPct(team)
        const teamTcdiff = tcdiff(team)
        const isFirst    = i === 0
        return (
          <Link
            key={team.id}
            href={`/teams/${team.id}`}
            className={clsx(
              `grid ${GRID} items-center px-3 py-2.5 gap-1 border-b border-bb-border/60 last:border-0 transition-colors group ${MIN_W}`,
              isFirst ? 'hover:bg-bb-gold/8' : 'hover:bg-bb-gold/5',
            )}
          >
            <div className="text-center"><RankMedal rank={i + 1} /></div>

            <div className="min-w-0">
              <span className={clsx(
                'font-heading font-bold text-xs leading-tight block truncate transition-colors group-hover:text-bb-gold',
                isFirst ? 'text-white' : 'text-white/85',
              )}>
                {team.name}
              </span>
            </div>

            <span className="text-center text-[10px] font-heading font-bold text-bb-gold/60 tabular-nums">
              {Math.round(team.eloRating)}
            </span>

            <span className="text-[10px] text-bb-muted truncate">{team.coachName}</span>

            <span className="text-center text-[10px] font-heading font-bold text-bb-muted/50 tabular-nums">
              {Math.round(team.coachEloRating)}
            </span>

            <span className="text-[10px] text-bb-muted/60 truncate">{team.race}</span>

            <span className="text-right text-[10px] font-heading font-bold text-bb-gold/80 tabular-nums">
              {team.teamValue}<span className="text-bb-muted/50 font-normal ml-0.5">k</span>
            </span>

            <span className="text-center text-xs font-semibold text-green-400">{team.wins}</span>
            <span className="text-center text-xs text-bb-crimson-bright">{team.losses}</span>
            <span className="text-center text-xs text-bb-muted">{team.draws}</span>

            <span className="text-center text-[10px] text-green-400/70 tabular-nums">{team.streakWin}</span>
            <span className="text-center text-[10px] text-bb-crimson-bright/70 tabular-nums">{team.streakLoss}</span>
            <span className="text-center text-[10px] text-bb-muted/60 tabular-nums">{team.streakDraw}</span>

            <span className="text-center text-[10px] text-bb-muted tabular-nums">{teamGp}</span>

            <span className="text-center text-[10px] font-heading tabular-nums text-bb-muted/70">
              {teamGp > 0 ? teamWinPct.toFixed(1) : '—'}
            </span>

            <span className="text-center text-[10px] text-bb-muted tabular-nums">{team.tdsScored}</span>
            <span className="text-center text-[10px] text-bb-muted tabular-nums">{team.tdsConceded}</span>

            <span className="text-center text-[10px] text-bb-gold/60 tabular-nums">{team.wonPrizes}</span>

            <span className={clsx(
              'text-center font-heading font-black text-sm tabular-nums',
              isFirst ? 'text-bb-gold' : 'text-bb-gold/70',
            )}>
              {teamPts}
            </span>

            <span className="text-center text-[10px] text-bb-muted/70 tabular-nums">{team.tcasf}</span>
            <span className="text-center text-[10px] text-bb-muted/70 tabular-nums">{team.tcasa}</span>

            <span className="text-center text-[10px] font-heading font-bold"><Diff val={team.tdsDiff} /></span>
            <span className="text-center text-[10px] font-heading font-bold"><Diff val={teamTcdiff} /></span>
          </Link>
        )
      })}
    </div>
  )
}
