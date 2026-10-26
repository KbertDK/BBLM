'use client'

import { useState, useTransition } from 'react'
import { TIEBREAKER_KEYS, TIEBREAKER_LABELS, DEFAULT_TIEBREAKERS } from '@/lib/tiebreakers'
import type { TiebreakerKey } from '@/lib/tiebreakers'
import { updateLeagueTiebreakers } from './actions'

export default function TiebreakersConfig({ leagueId, current }: {
  leagueId: string
  current: TiebreakerKey[]
}) {
  const initial: TiebreakerKey[] = [
    ...current.filter((k): k is TiebreakerKey => (TIEBREAKER_KEYS as readonly string[]).includes(k)),
    ...TIEBREAKER_KEYS.filter(k => !current.includes(k)),
  ]

  const [order, setOrder] = useState<TiebreakerKey[]>(initial)
  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function move(index: number, dir: -1 | 1) {
    const next = [...order]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setOrder(next)
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      await updateLeagueTiebreakers(leagueId, order)
      setSaved(true)
    })
  }

  function reset() {
    setOrder([...DEFAULT_TIEBREAKERS])
    setSaved(false)
  }

  return (
    <div className="border border-bb-border/30 rounded-sm bg-bb-darker/40 p-3 mt-2">
      <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 mb-2.5">
        Tiebreaker Order
        <span className="ml-2 normal-case font-normal text-bb-muted/30">when points are equal, apply in order:</span>
      </p>
      <ol className="space-y-1 mb-3">
        {order.map((key, i) => (
          <li key={key} className="flex items-center gap-2 group/row">
            <span className="text-[10px] font-heading text-bb-muted/30 w-4 text-right shrink-0">{i + 1}.</span>
            <span className="flex-1 text-xs text-bb-muted">{TIEBREAKER_LABELS[key]}</span>
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="px-1.5 py-0.5 text-xs text-bb-muted/60 hover:text-white disabled:opacity-20 border border-bb-border/40 rounded-sm hover:border-bb-muted/40 transition-colors"
                aria-label="Move up"
              >↑</button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === order.length - 1}
                className="px-1.5 py-0.5 text-xs text-bb-muted/60 hover:text-white disabled:opacity-20 border border-bb-border/40 rounded-sm hover:border-bb-muted/40 transition-colors"
                aria-label="Move down"
              >↓</button>
            </div>
          </li>
        ))}
      </ol>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm border border-bb-gold/40 text-bb-gold hover:bg-bb-gold/10 transition-colors disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save Order'}
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={isPending}
          className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm border border-bb-border/40 text-bb-muted/60 hover:text-white hover:border-bb-muted/40 transition-colors disabled:opacity-50"
        >
          Reset
        </button>
        {saved && !isPending && (
          <span className="text-xs text-green-400 font-heading tracking-wide">Saved</span>
        )}
      </div>
    </div>
  )
}
