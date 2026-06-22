'use client'

import { useState, useCallback } from 'react'

// ── Block die face types ──────────────────────────────────────────────────────
type FaceId = 'push' | 'def-stumbles' | 'att-down' | 'both-down' | 'def-down'

interface Face {
  id: FaceId
  label: string
  colorClass: string
}

// 6 faces — Push Back appears twice (faces 1 & 6)
const BLOCK_FACES: Face[] = [
  { id: 'push',         label: 'Push Back',     colorClass: 'text-white'              },
  { id: 'def-stumbles', label: 'Def. Stumbles', colorClass: 'text-yellow-300'         },
  { id: 'att-down',     label: 'Attacker Down', colorClass: 'text-bb-crimson-bright'  },
  { id: 'both-down',    label: 'Both Down',     colorClass: 'text-bb-crimson-bright'  },
  { id: 'def-down',     label: 'Defender Down', colorClass: 'text-bb-gold'            },
  { id: 'push',         label: 'Push Back',     colorClass: 'text-white'              },
]

// ── SVG geometry constants ────────────────────────────────────────────────────
// 8-point starburst, outer r=14, inner r=7.5, center 16,16
const SB = "16,2 18.9,9.1 25.9,6.1 22.9,13.1 30,16 22.9,18.9 25.9,25.9 18.9,22.9 16,30 13.1,22.9 6.1,25.9 9.1,18.9 2,16 9.1,13.1 6.1,6.1 13.1,9.1"
// BothDown starburst: upper-left quadrant, center (10,10), outer r=9, inner r=4.5
// Right/bottom spikes reach ~x=19, y=19 — just kissing the skull's upper-left corner
const SB_BD = "10,1 11.7,5.8 16.4,3.6 14.2,8.3 19,10 14.2,11.7 16.4,16.4 11.7,14.2 10,19 8.3,14.2 3.6,16.4 5.8,11.7 1,10 5.8,8.3 3.6,3.6 8.3,5.8"
// Classic cursor arrow (pointer tip upper-left) as a polygon
const CURSOR = "6,2 6,23 10,18 13,27 18,25 14,16 21,16"

// Skull paths — full size (used in AttackerDown)
const SKULL_HEAD = "M16 4 C8 4 3 10 3 15 C3 21 7 24.5 11 25.5 L11 28 L21 28 L21 25.5 C25 24.5 29 21 29 15 C29 10 24 4 16 4Z"
const SKULL_NOSE = "M14.5 20 L17.5 20 L16 22.5Z"

// BothDown skull: lower-right quadrant, center (22,21)
// Left edge ~x=14 overlaps slightly with starburst's x=16–19 right spikes
const SKULL_BD_HEAD = "M22 14 C18 14 14 17.5 14 21 C14 24.5 16.5 26.5 19 27.3 L19 29.5 L25 29.5 L25 27.3 C27.5 26.5 30 24.5 30 21 C30 17.5 26 14 22 14Z"
const SKULL_BD_NOSE = "M20.5 24.5 L23.5 24.5 L22 27Z"

// ── Icon components ───────────────────────────────────────────────────────────
function IconPush({ size, cls }: { size: number; cls: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cls} fill="currentColor" strokeLinejoin="round">
      <polygon points={CURSOR} />
    </svg>
  )
}

function IconDefenderStumbles({ size, cls }: { size: number; cls: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <polygon points={SB} />
      <text x="16" y="21" textAnchor="middle" fontSize="13" fontWeight="900" fill="currentColor" stroke="none" fontFamily="sans-serif">!</text>
    </svg>
  )
}

function IconAttackerDown({ size, cls }: { size: number; cls: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cls} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d={SKULL_HEAD} />
      <circle cx="12" cy="15" r="2.5" />
      <circle cx="20" cy="15" r="2.5" />
      <path d={SKULL_NOSE} />
      <line x1="13" y1="25.5" x2="13" y2="28" />
      <line x1="16" y1="25.5" x2="16" y2="28" />
      <line x1="19" y1="25.5" x2="19" y2="28" />
    </svg>
  )
}

function IconBothDown({ size, cls }: { size: number; cls: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cls} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      {/* Starburst — upper-left */}
      <polygon points={SB_BD} />
      {/* Skull — lower-right, just touching the starburst's bottom-right spikes */}
      <path d={SKULL_BD_HEAD} />
      <circle cx="19" cy="21" r="2" />
      <circle cx="25" cy="21" r="2" />
      <path d={SKULL_BD_NOSE} />
      <line x1="20" y1="27.3" x2="20" y2="29.5" />
      <line x1="22" y1="27.3" x2="22" y2="29.5" />
      <line x1="24" y1="27.3" x2="24" y2="29.5" />
    </svg>
  )
}

function IconDefenderDown({ size, cls }: { size: number; cls: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cls} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round">
      <polygon points={SB} />
    </svg>
  )
}

function BlockFaceIcon({ face, size }: { face: Face; size: number }) {
  switch (face.id) {
    case 'push':         return <IconPush             size={size} cls={face.colorClass} />
    case 'def-stumbles': return <IconDefenderStumbles size={size} cls={face.colorClass} />
    case 'att-down':     return <IconAttackerDown     size={size} cls={face.colorClass} />
    case 'both-down':    return <IconBothDown         size={size} cls={face.colorClass} />
    case 'def-down':     return <IconDefenderDown     size={size} cls={face.colorClass} />
  }
}

// ── Dice logic ────────────────────────────────────────────────────────────────
function rollNumeric(sides: number, count = 1): string[] {
  return Array.from({ length: count }, () => String(Math.ceil(Math.random() * sides)))
}

function rollBlock(count: number): Face[] {
  return Array.from({ length: count }, () => BLOCK_FACES[Math.floor(Math.random() * BLOCK_FACES.length)])
}

const NUMERIC_DICE = [
  { label: 'D3',  sides: 3,  count: 1 },
  { label: 'D6',  sides: 6,  count: 1 },
  { label: '2D6', sides: 6,  count: 2 },
  { label: 'D8',  sides: 8,  count: 1 },
  { label: 'D16', sides: 16, count: 1 },
]

const BLOCK_DICE_OPTS = [
  { label: 'Block ×1', count: 1 },
  { label: 'Block ×2', count: 2 },
  { label: 'Block ×3', count: 3 },
]

type RollResult =
  | { type: 'numeric'; values: string[]; label: string }
  | { type: 'block';   faces: Face[];    label: string }

// ── Component ─────────────────────────────────────────────────────────────────
export default function DiceRoller() {
  const [open,    setOpen]    = useState(false)
  const [result,  setResult]  = useState<RollResult | null>(null)
  const [rolling, setRolling] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  const rollN = useCallback((values: string[], label: string) => {
    setRolling(true)
    setResult(null)
    setTimeout(() => {
      setResult({ type: 'numeric', values, label })
      setAnimKey((k) => k + 1)
      setRolling(false)
    }, 350)
  }, [])

  const rollB = useCallback((faces: Face[], label: string) => {
    setRolling(true)
    setResult(null)
    setTimeout(() => {
      setResult({ type: 'block', faces, label })
      setAnimKey((k) => k + 1)
      setRolling(false)
    }, 350)
  }, [])

  const btnBase  = 'px-3 py-2 rounded-sm border text-xs font-heading uppercase tracking-widest transition-colors disabled:opacity-40'
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
                    onClick={() => rollN(rollNumeric(d.sides, d.count), d.label)}
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
                {BLOCK_DICE_OPTS.map((d) => (
                  <button
                    key={d.label}
                    disabled={rolling}
                    onClick={() => rollB(rollBlock(d.count), d.label)}
                    className={btnGhost}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Result */}
            <div className="min-h-[72px] flex flex-col items-center justify-center border-t border-bb-border/40 pt-3">
              {rolling && (
                <span className="text-bb-muted/50 text-xs font-heading uppercase tracking-widest animate-pulse">Rolling…</span>
              )}

              {!rolling && result?.type === 'numeric' && (
                <>
                  <p className="text-[10px] text-bb-muted/40 font-heading uppercase tracking-widest mb-1">{result.label}</p>
                  <div key={animKey} className="flex flex-wrap justify-center gap-3 animate-[td-blast_0.4s_ease-out]">
                    {result.values.map((v, i) => (
                      <span key={i} className="font-heading font-black text-3xl leading-none text-white">{v}</span>
                    ))}
                  </div>
                  {result.values.length > 1 && (
                    <p className="text-[10px] text-bb-muted/50 mt-1">
                      Total: {result.values.reduce((s, v) => s + Number(v), 0)}
                    </p>
                  )}
                </>
              )}

              {!rolling && result?.type === 'block' && (
                <>
                  <p className="text-[10px] text-bb-muted/40 font-heading uppercase tracking-widest mb-2">{result.label}</p>
                  <div key={animKey} className="flex flex-wrap justify-center gap-4 animate-[td-blast_0.4s_ease-out]">
                    {result.faces.map((face, i) => (
                      <div key={i} className="flex flex-col items-center gap-1.5">
                        <BlockFaceIcon face={face} size={44} />
                        <span className={`text-[9px] font-heading uppercase tracking-wide leading-none ${face.colorClass}`}>
                          {face.label}
                        </span>
                      </div>
                    ))}
                  </div>
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
