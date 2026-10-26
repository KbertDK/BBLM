'use client'

import { useState, useTransition } from 'react'
import { TIEBREAKER_KEYS, TIEBREAKER_LABELS, DEFAULT_TIEBREAKERS } from '@/lib/tiebreakers'
import type { TiebreakerKey } from '@/lib/tiebreakers'
import { updateLeagueTiebreakers } from './actions'

export default function TiebreakersConfig({ leagueId, current }: {
  leagueId: string
  current: TiebreakerKey[]
}) {
  // `active` = ordered list of enabled tiebreakers (what gets saved)
  // `inactive` = excluded tiebreakers (not applied)
  const [active, setActive] = useState<TiebreakerKey[]>(() => {
    const valid = current.filter((k): k is TiebreakerKey =>
      (TIEBREAKER_KEYS as readonly string[]).includes(k)
    )
    return valid.length > 0 ? valid : [...DEFAULT_TIEBREAKERS]
  })

  const inactive = TIEBREAKER_KEYS.filter(k => !active.includes(k))

  const [saved, setSaved] = useState(false)
  const [isPending, startTransition] = useTransition()

  function move(index: number, dir: -1 | 1) {
    const next = [...active]
    const target = index + dir
    if (target < 0 || target >= next.length) return
    ;[next[index], next[target]] = [next[target], next[index]]
    setActive(next)
    setSaved(false)
  }

  function disable(key: TiebreakerKey) {
    setActive(prev => prev.filter(k => k !== key))
    setSaved(false)
  }

  function enable(key: TiebreakerKey) {
    setActive(prev => [...prev, key])
    setSaved(false)
  }

  function reset() {
    setActive([...DEFAULT_TIEBREAKERS])
    setSaved(false)
  }

  function save() {
    startTransition(async () => {
      await updateLeagueTiebreakers(leagueId, active)
      setSaved(true)
    })
  }

  return (
    <div className="border border-bb-border/30 rounded-sm bg-bb-darker/40 p-3 mt-2">
      <p className="text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 mb-2.5">
        Tiebreaker Order
        <span className="ml-2 normal-case font-normal text-bb-muted/30">applied in order when points are equal</span>
      </p>

      {/* Active tiebreakers */}
      {active.length === 0 && (
        <p className="text-xs text-bb-muted/40 italic mb-2">No tiebreakers active — all ties resolved by coin flip.</p>
      )}
      <ol className="space-y-1 mb-2">
        {active.map((key, i) => (
          <li key={key} className="flex items-center gap-2">
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
                disabled={i === active.length - 1}
                className="px-1.5 py-0.5 text-xs text-bb-muted/60 hover:text-white disabled:opacity-20 border border-bb-border/40 rounded-sm hover:border-bb-muted/40 transition-colors"
                aria-label="Move down"
              >↓</button>
              <button
                type="button"
                onClick={() => disable(key)}
                className="px-1.5 py-0.5 text-xs text-bb-crimson-bright/60 hover:text-bb-crimson-bright border border-bb-border/40 rounded-sm hover:border-bb-crimson/40 transition-colors ml-0.5"
                aria-label="Exclude"
                title="Exclude from tiebreaking"
              >✕</button>
            </div>
          </li>
        ))}
      </ol>

      {/* Inactive tiebreakers */}
      {inactive.length > 0 && (
        <div className="border-t border-bb-border/20 pt-2 mb-3 space-y-1">
          {inactive.map(key => (
            <div key={key} className="flex items-center gap-2 opacity-40">
              <span className="w-4 shrink-0" />
              <span className="flex-1 text-xs text-bb-muted line-through">{TIEBREAKER_LABELS[key]}</span>
              <button
                type="button"
                onClick={() => enable(key)}
                className="px-1.5 py-0.5 text-xs text-green-400/80 hover:text-green-400 border border-bb-border/40 rounded-sm hover:border-green-700/50 transition-colors opacity-100"
                aria-label="Enable"
                title="Include in tiebreaking"
              >+</button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 mt-1">
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
