export const TIEBREAKER_KEYS = ['WINS', 'TD_DIFF', 'TD_SCORED', 'DRAWS', 'LOSSES', 'ELO'] as const
export type TiebreakerKey = typeof TIEBREAKER_KEYS[number]

export const TIEBREAKER_LABELS: Record<TiebreakerKey, string> = {
  WINS:      'Most Wins',
  TD_DIFF:   'TD Difference',
  TD_SCORED: 'TDs Scored',
  DRAWS:     'Most Draws',
  LOSSES:    'Fewest Losses',
  ELO:       'ELO Rating',
}

export const DEFAULT_TIEBREAKERS: TiebreakerKey[] = ['WINS', 'TD_DIFF', 'TD_SCORED', 'DRAWS', 'LOSSES', 'ELO']

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
