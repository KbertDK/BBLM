'use client'

import { useState } from 'react'

interface SkillOption {
  id:        string
  name:      string
  category:  string
  skillRule: string
}

const CATEGORY_LABEL: Record<string, string> = {
  G: 'General', A: 'Agility', P: 'Passing', S: 'Strength', M: 'Mutation', E: 'Extraordinary',
}

const CAT_COLOR: Record<string, string> = {
  G: 'text-blue-300   border-blue-300/30   bg-blue-300/5',
  A: 'text-green-300  border-green-300/30  bg-green-300/5',
  P: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/5',
  S: 'text-bb-crimson-bright border-bb-crimson/30 bg-bb-crimson/5',
  M: 'text-purple-300 border-purple-300/30 bg-purple-300/5',
  E: 'text-bb-gold    border-bb-gold/30    bg-bb-gold/5',
}

export default function SkillPickerModal({
  rollId, options, pickSkill,
}: {
  rollId:    string
  options:   SkillOption[]
  pickSkill: (formData: FormData) => void
}) {
  const [open, setOpen]         = useState(false)
  const [selected, setSelected] = useState<SkillOption | null>(null)

  const sorted = [...options].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name))

  return (
    <>
      <form action={pickSkill} className="mt-1 flex items-center gap-1">
        <input type="hidden" name="rollId" value={rollId} />
        <input type="hidden" name="skillId" value={selected?.id ?? ''} />
        <button type="button" onClick={() => setOpen(true)}
          className="px-2 py-0.5 rounded-sm border border-bb-border text-bb-muted text-[10px] font-heading uppercase hover:border-bb-gold hover:text-bb-gold transition-colors max-w-[10rem] truncate">
          {selected ? selected.name : 'Select skill…'}
        </button>
        <button type="submit" disabled={!selected}
          className="px-2 py-0.5 rounded-sm border border-bb-gold/50 text-bb-gold text-[10px] font-heading uppercase hover:bg-bb-gold hover:text-bb-dark transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
          Learn
        </button>
      </form>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-lg max-h-[80vh] flex flex-col bg-bb-dark border border-bb-gold/30 rounded-sm shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-bb-border shrink-0">
              <h3 className="font-heading text-sm font-bold text-bb-gold uppercase tracking-wide">Select Skill</h3>
              <button onClick={() => setOpen(false)} className="text-bb-muted hover:text-white transition-colors">✕</button>
            </div>
            <div className="overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-bb-dark">
                  <tr className="text-[10px] font-heading uppercase tracking-wider text-bb-muted/60 border-b border-bb-border">
                    <th className="text-left px-4 py-2">Skill</th>
                    <th className="text-left px-4 py-2 w-24">Category</th>
                    <th className="text-left px-4 py-2">Description</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((s) => (
                    <tr
                      key={s.id}
                      onClick={() => { setSelected(s); setOpen(false) }}
                      className="border-b border-bb-border/30 last:border-0 hover:bg-bb-gold/5 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-2.5 font-bold text-white whitespace-nowrap align-top">{s.name}</td>
                      <td className="px-4 py-2.5 align-top">
                        <span className={`inline-block px-1.5 py-0.5 rounded-sm border text-[10px] whitespace-nowrap ${CAT_COLOR[s.category] ?? ''}`}>
                          {CATEGORY_LABEL[s.category] ?? s.category}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-bb-muted leading-snug">{s.skillRule}</td>
                    </tr>
                  ))}
                  {sorted.length === 0 && (
                    <tr>
                      <td colSpan={3} className="px-4 py-6 text-center text-bb-muted/50 italic">No eligible skills.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
