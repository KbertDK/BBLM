export const TIEBREAKER_KEYS = [
  'WINS', 'LOSSES', 'DRAWS', 'PTS',
  'TD_SCORED', 'TD_CONCEDED', 'TD_DIFF',
  'TCASF', 'TCASA', 'TCDIFF',
] as const
export type TiebreakerKey = typeof TIEBREAKER_KEYS[number]

export const TIEBREAKER_LABELS: Record<TiebreakerKey, string> = {
  WINS:        'Most Wins (W)',
  LOSSES:      'Fewest Losses (L)',
  DRAWS:       'Most Draws (D)',
  PTS:         'Points (PTS)',
  TD_SCORED:   'Goals For (GF)',
  TD_CONCEDED: 'Goals Against (GA)',
  TD_DIFF:     'Score Diff (s±)',
  TCASF:       'Casualties For (CsF)',
  TCASA:       'Casualties Against (CsA)',
  TCDIFF:      'Cas Diff (Cs±)',
}

export const DEFAULT_TIEBREAKERS: TiebreakerKey[] = ['PTS', 'TD_SCORED', 'TCASF', 'TD_DIFF', 'TCDIFF']

export function parseTiebreakers(raw: string | null | undefined): TiebreakerKey[] {
  if (!raw) return DEFAULT_TIEBREAKERS
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const filtered = parsed.filter((k): k is TiebreakerKey =>
        (TIEBREAKER_KEYS as readonly string[]).includes(k)
      )
      if (filtered.length > 0) return filtered
    }
  } catch {}
  return DEFAULT_TIEBREAKERS
}
