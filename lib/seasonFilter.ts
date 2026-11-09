import prisma from '@/lib/prisma'
import type { SeasonStatus } from '@prisma/client'

export type SeasonMode =
  | { kind: 'active' }
  | { kind: 'closed' }
  | { kind: 'season'; seasonId: string }

export function parseSeasonMode(raw: string | undefined): SeasonMode {
  if (!raw || raw === 'active') return { kind: 'active' }
  if (raw === 'closed') return { kind: 'closed' }
  return { kind: 'season', seasonId: raw }
}

// 'active'  -> Season.status IN ('ACTIVE','READY') — the currently ongoing/ready-to-start season(s)
// 'closed'  -> Season.status = 'ENDED'             — every finished season, merged
// 'season'  -> exactly the one requested seasonId
export async function resolveSeasonIds(leagueId: string | undefined, mode: SeasonMode): Promise<string[]> {
  if (mode.kind === 'season') return [mode.seasonId]

  const statuses: SeasonStatus[] = mode.kind === 'active' ? ['ACTIVE', 'READY'] : ['ENDED']
  const seasons = await prisma.season.findMany({
    where:  { status: { in: statuses }, ...(leagueId ? { leagueId } : {}) },
    select: { id: true },
  })
  return seasons.map((s) => s.id)
}

export interface SeasonFilterOption {
  id:         string
  name:       string
  status:     'PLANNING' | 'READY' | 'ACTIVE' | 'ENDED'
  leagueName: string
}

// Non-PLANNING seasons in scope — for a "pick a specific season" dropdown.
export async function getSeasonFilterOptions(leagueId?: string): Promise<SeasonFilterOption[]> {
  const seasons = await prisma.season.findMany({
    where:   { status: { not: 'PLANNING' }, ...(leagueId ? { leagueId } : {}) },
    orderBy: [{ league: { name: 'asc' } }, { season: 'desc' }],
    select:  { id: true, name: true, status: true, league: { select: { name: true } } },
  })
  return seasons.map((s) => ({ id: s.id, name: s.name, status: s.status, leagueName: s.league.name }))
}
