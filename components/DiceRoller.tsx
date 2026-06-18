'use client'

import { useState, useCallback } from 'react'

// Official 6-face Blood Bowl block die
const BLOCK_FACES = [
  '💀 Attacker Down',   // ×1 — turnover for the attacker
  '↕ Both Down',        // ×1 — both fall (Block skill cancels for attacker)
  '→ Push',             // ×2 — defender pushed back, no knockdown
  '→ Push',
  '~ Def. Stumbles',    // ×1 — defender falls unless they have Dodge
  '⚡ Defender Down',   // ×1 — best result: defender knocked down
]

function rollNumeric(sides: number, count = 1): string[] {
  return Array.from({ length: count }, () => String(Math.ceil(Math.random() * sides)))
}

function rollBlock(count: number): string[] {
  return Array.from({ length: count }, () => BLOCK_FACES[Math.floor(Math.random() * BLOCK_FACES.length)])
}

const NUMERIC_DICE = [
  { label: 'D3',  sides: 3,  count: 1 },
  { label: 'D6',  sides: 6,  count: 1 },
  { label: '2D6', sides: 6,  count: 2 },
  { label: 'D8',  sides: 8,  count: 1 },
  { label: 'D16', sides: 16, count: 1 },
]

const BLOCK_DICE = [
  { label: 'Block ×1', count: 1 },
  { label: 'Block ×2', count: 2 },
  { label: 'Block ×3', count: 3 },
]

export default function DiceRoller() {
  const [open, setOpen]       = useState(false)
  const [result, setResult]   = useState<string[] | null>(null)
  const [label, setLabel]     = useState<string>('')
  const [rolling, setRolling] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  const roll = useCallback((values: string[], dieLabel: string) => {
    setRolling(true)
    setResult(null)
    setTimeout(() => {
      setResult(values)
      setLabel(dieLabel)
      setAnimKey((k) => k + 1)
      setRolling(false)
    }, 350)
  }, [])

  const btnBase = 'px-3 py-2 rounded-sm border text-xs font-heading uppercase tracking-widest transition-colors disabled:opacity-40'
  const btnGhost = `${btnBase} border-bb-border text-bb-muted hover:text-white hover:border-bb-muted`

  return (
    <>
      {/* Floating trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Open dice roller"
        className="fixed bottom-6 right-6 z-40 w-12 h-12 flex items-center justify-center rounded-sm bg-bb-dark border border-bb-gold/40 text-bb-gold text-2xl shadow-lg hover:bg-bb-gold/10 hover:border-bb-gold/70 transition-all"
      >
        🎲
      </button>

      {/* Panel */}
      {open && (
        <div className="fixed bottom-20 right-6 z-50 w-72 bg-bb-dark border border-bb-gold/30 rounded-sm shadow-2xl overflow-hidden">

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-bb-border">
            <span className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">Dice Roller</span>
            <button onClick={() => setOpen(false)} className="text-bb-muted hover:text-white transition-colors text-sm">✕</button>
          </div>

          <div className="px-4 py-4 space-y-4">

            {/* Numeric dice */}
            <div>
              <p className="text-[10px] text-bb-muted/50 font-heading uppercase tracking-widest mb-2">Numeric</p>
              <div className="grid grid-cols-5 gap-1.5">
                {NUMERIC_DICE.map((d) => (
                  <button
                    key={d.label}
                    disabled={rolling}
                    onClick={() => roll(rollNumeric(d.sides, d.count), d.label)}
                    className={btnGhost}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Block dice */}
            <div>
              <p className="text-[10px] text-bb-muted/50 font-heading uppercase tracking-widest mb-2">Block Die</p>
              <div className="grid grid-cols-3 gap-1.5">
                {BLOCK_DICE.map((d) => (
                  <button
                    key={d.label}
                    disabled={rolling}
                    onClick={() => roll(rollBlock(d.count), d.label)}
                    className={btnGhost}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            <div className="min-h-[56px] flex flex-col items-center justify-center border-t border-bb-border/40 pt-3">
              {rolling && (
                <span className="text-bb-muted/50 text-xs font-heading uppercase tracking-widest animate-pulse">Rolling…</span>
              )}
              {!rolling && result && (
                <>
                  <p className="text-[10px] text-bb-muted/40 font-heading uppercase tracking-widest mb-1">{label}</p>
                  <div key={animKey} className="flex flex-wrap justify-center gap-2 animate-[td-blast_0.4s_ease-out]">
                    {result.map((v, i) => (
                      <span
                        key={i}
                        className={`font-heading font-black text-xl leading-none ${
                          v.includes('Attacker Down') || v.includes('Both Down')
                            ? 'text-bb-crimson-bright'
                            : v.includes('Defender Down')
                            ? 'text-bb-gold'
                            : 'text-white'
                        }`}
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                  {result.length > 1 && result.every((v) => !isNaN(Number(v))) && (
                    <p className="text-[10px] text-bb-muted/50 mt-1">
                      Total: {result.reduce((s, v) => s + Number(v), 0)}
                    </p>
                  )}
                </>
              )}
              {!rolling && !result && (
                <span className="text-bb-muted/30 text-xs italic">Pick a die above</span>
              )}
            </div>

          </div>
        </div>
      )}
    </>
  )
}
