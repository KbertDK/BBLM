'use client'

import React, { useState } from 'react'
import {
  createPrizeType, updatePrizeType, togglePrizeTypeStatus,
  deletePrizeType, awardPrize, removeAward,
} from './prize-actions'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface PrizeTypeRow {
  id:     string
  name:   string
  type:   'TEAM' | 'PLAYER'
  status: 'ACTIVE' | 'INACTIVE'
  icon:   string
}

export interface TournamentOption {
  id:          string
  name:        string
  divisionIds: string[]
}

export interface PlayerOption {
  id:         string
  name:       string | null
  playerType: { name: string }
}

export interface TeamOption {
  id:         string
  name:       string
  divisionId: string | null
  players:    PlayerOption[]
}

export interface AwardRow {
  id:           string
  prizeTypeId:  string
  tournamentId: string
  teamId:       string | null
  teamPlayerId: string | null
  teamName:     string | null
  playerName:   string | null
  playerRole:   string | null
}

interface Props {
  prizeTypes:  PrizeTypeRow[]
  tournaments: TournamentOption[]
  teams:       TeamOption[]
  awards:      AwardRow[]
}

// ── Icon catalogue ─────────────────────────────────────────────────────────────

const PRIZE_ICONS = [
  { key: 'horned-skull',          label: 'Horned Skull' },
  { key: 'silver-medal',          label: 'Silver Medal' },
  { key: 'bronze-medal',          label: 'Bronze Medal' },
  { key: 'spiked-chalice',        label: 'Spiked Chalice' },
  { key: 'golden-elf-spiked-ball', label: 'Golden Elf & Spiked Ball' },
  { key: 'golden-quarterback',    label: 'Golden Quarterback' },
  { key: 'gauntlet-dagger',       label: 'Gauntlet & Dagger' },
  { key: 'spiked-horn',           label: 'Spiked Horn' },
  { key: 'horned-helm-cup',       label: 'Horned Helm Cup' },
]

// ── Shared style helpers ───────────────────────────────────────────────────────

function inputCls(extra = '') {
  return `bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40 ${extra}`
}

function btnCls(variant: 'primary' | 'ghost' | 'danger' | 'muted' = 'ghost', extra = '') {
  const base = 'text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed'
  const variants = {
    primary: 'bg-bb-crimson hover:bg-bb-crimson-bright text-white',
    ghost:   'border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted',
    danger:  'border border-bb-crimson/40 text-bb-crimson-bright hover:bg-bb-crimson/20',
    muted:   'text-bb-muted/50 border border-bb-border/50',
  }
  return `${base} ${variants[variant]} ${extra}`
}

function Badge({ label, cls }: { label: string; cls: string }) {
  return <span className={`text-xs px-1.5 py-0.5 rounded-sm border ${cls}`}>{label}</span>
}

function Chevron({ cls = '' }: { cls?: string }) {
  return (
    <svg className={`w-3 h-3 shrink-0 transition-transform group-open:rotate-90 ${cls}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Icon picker sub-component ──────────────────────────────────────────────────

function IconPicker({ selected, onSelect }: { selected: string; onSelect: (key: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PRIZE_ICONS.map(({ key, label }) => (
        <button
          key={key}
          type="button"
          title={label}
          onClick={() => onSelect(key)}
          className={`w-12 h-12 rounded-sm border-2 flex items-center justify-center transition-colors ${
            selected === key
              ? 'border-bb-gold bg-bb-gold/10'
              : 'border-bb-border bg-bb-darker hover:border-bb-muted'
          }`}
        >
          <img src={`/prizes/${key}.svg`} alt={label} className="w-8 h-8 object-contain" />
        </button>
      ))}
    </div>
  )
}

// ── Prize icon thumbnail ───────────────────────────────────────────────────────

function PrizeIcon({ icon, size = 32 }: { icon: string; size?: number }) {
  if (!icon) return <span className="w-8 h-8 rounded-sm bg-bb-border/30 inline-block" />
  return (
    <img
      src={`/prizes/${icon}.svg`}
      alt={icon}
      width={size}
      height={size}
      className="object-contain"
    />
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PrizesTab({ prizeTypes, tournaments, teams, awards }: Props) {
  const [createIcon, setCreateIcon]           = useState('')
  const [expandedId, setExpandedId]           = useState<string | null>(null)
  const [editIcons, setEditIcons]             = useState<Record<string, string>>({})
  const [selectedTournament, setSelectedTournament] = useState('')

  const activePrizes = prizeTypes.filter((p) => p.status === 'ACTIVE')

  const tournamentTeams = (divisionIds: string[]) =>
    teams.filter((t) => t.divisionId && divisionIds.includes(t.divisionId))

  const winnerLabel = (award: AwardRow) => {
    if (award.teamName) return award.teamName
    if (award.playerName) return `${award.playerName ?? '—'} (${award.playerRole ?? ''})`
    return '—'
  }

  return (
    <div className="space-y-10">

      {/* ── Section 1: Prize Types ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-4 mb-5">
          <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase whitespace-nowrap">Prize Types</h2>
          <div className="flex-1 h-px bg-bb-border" />
        </div>

        {/* Create form */}
        <details className="group bg-bb-dark border border-bb-border rounded-sm">
          <summary className="flex items-center gap-2 px-4 py-3 cursor-pointer [list-style:none] [&::-webkit-details-marker]:hidden hover:bg-bb-darker/40 transition-colors select-none">
            <Chevron cls="text-bb-muted" />
            <span className="text-bb-gold text-xs font-medium uppercase tracking-widest">Create new prize type</span>
          </summary>
          <form
            action={async (fd) => { await createPrizeType(fd); setCreateIcon('') }}
            className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3"
          >
            <div className="flex gap-2">
              <input name="name" required placeholder="Prize name" className={inputCls('flex-1')} />
              <select name="type" required className={inputCls('w-36')}>
                <option value="TEAM">Team prize</option>
                <option value="PLAYER">Player prize</option>
              </select>
            </div>
            <div>
              <p className="text-xs text-bb-muted mb-2 uppercase tracking-widest">Icon</p>
              <input type="hidden" name="icon" value={createIcon} />
              <IconPicker selected={createIcon} onSelect={setCreateIcon} />
            </div>
            <button type="submit" className={btnCls('primary')}>Create</button>
          </form>
        </details>

        {/* Prize list */}
        <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
          {prizeTypes.length === 0 && (
            <p className="text-bb-muted/50 text-sm italic px-4 py-3">No prize types yet.</p>
          )}
          {prizeTypes.map((pt) => {
            const isExpanded = expandedId === pt.id
            const currentIcon = editIcons[pt.id] ?? pt.icon
            const hasAwards   = awards.some((a) => a.prizeTypeId === pt.id)

            return (
              <div key={pt.id} className="bg-bb-dark">
                {/* Row header */}
                <div
                  className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-bb-darker/40 transition-colors select-none"
                  onClick={() => setExpandedId(isExpanded ? null : pt.id)}
                >
                  <PrizeIcon icon={pt.icon} size={32} />
                  <span className="font-heading font-bold text-white text-sm min-w-0 truncate">{pt.name}</span>
                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    <Badge
                      label={pt.type === 'TEAM' ? 'Team' : 'Player'}
                      cls={pt.type === 'TEAM' ? 'border-blue-700/50 text-blue-400 bg-blue-900/10' : 'border-amber-700/50 text-amber-400 bg-amber-900/10'}
                    />
                    {pt.status === 'ACTIVE'
                      ? <Badge label="Active"   cls="border-green-700/50 text-green-400 bg-green-900/10" />
                      : <Badge label="Inactive" cls="border-bb-muted/30 text-bb-muted/50 bg-bb-muted/5" />
                    }
                    <svg className={`w-3 h-3 text-bb-muted transition-transform ${isExpanded ? 'rotate-90' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                      <path d="M9 18l6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>

                {/* Expanded edit panel */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-3 border-t border-bb-border/40 space-y-3 bg-bb-darker/30">
                    <form action={updatePrizeType} className="space-y-3">
                      <input type="hidden" name="id" value={pt.id} />
                      <div className="flex gap-2">
                        <input name="name" defaultValue={pt.name} required className={inputCls('flex-1')} />
                        <select name="type" defaultValue={pt.type} className={inputCls('w-36')}>
                          <option value="TEAM">Team prize</option>
                          <option value="PLAYER">Player prize</option>
                        </select>
                      </div>
                      <div>
                        <p className="text-xs text-bb-muted mb-2 uppercase tracking-widest">Icon</p>
                        <input type="hidden" name="icon" value={currentIcon} />
                        <IconPicker
                          selected={currentIcon}
                          onSelect={(key) => setEditIcons((prev) => ({ ...prev, [pt.id]: key }))}
                        />
                      </div>
                      <button type="submit" className={btnCls('ghost')}>Save changes</button>
                    </form>

                    <div className="flex gap-2 pt-1 border-t border-bb-border/30">
                      <form action={togglePrizeTypeStatus}>
                        <input type="hidden" name="id" value={pt.id} />
                        <button type="submit" className={btnCls('ghost')}>
                          {pt.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                        </button>
                      </form>
                      <form action={deletePrizeType}>
                        <input type="hidden" name="id" value={pt.id} />
                        <button
                          type="submit"
                          disabled={hasAwards}
                          title={hasAwards ? 'Remove all awards for this prize first' : 'Delete prize type'}
                          className={btnCls(hasAwards ? 'muted' : 'danger')}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* ── Section 2: Award Prizes ── */}
      <section className="space-y-4">
        <div className="flex items-center gap-4 mb-5">
          <h2 className="font-heading text-lg font-bold text-bb-gold tracking-widest uppercase whitespace-nowrap">Award Prizes</h2>
          <div className="flex-1 h-px bg-bb-border" />
        </div>

        <div className="flex gap-2 items-center">
          <select
            value={selectedTournament}
            onChange={(e) => setSelectedTournament(e.target.value)}
            className={inputCls('flex-1 max-w-sm')}
          >
            <option value="">— Select a tournament —</option>
            {tournaments.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        </div>

        {selectedTournament && (() => {
          const t = tournaments.find((t) => t.id === selectedTournament)!
          const tTeams = tournamentTeams(t.divisionIds)

          if (tTeams.length === 0) {
            return (
              <p className="text-bb-muted/50 text-sm italic">No teams in this tournament&apos;s divisions.</p>
            )
          }

          if (activePrizes.length === 0) {
            return (
              <p className="text-bb-muted/50 text-sm italic">No active prize types. Activate or create some above.</p>
            )
          }

          return (
            <div className="border border-bb-border rounded-sm divide-y divide-bb-border/50 overflow-hidden">
              {activePrizes.map((prize) => {
                const award = awards.find(
                  (a) => a.prizeTypeId === prize.id && a.tournamentId === selectedTournament
                )

                return (
                  <div key={prize.id} className="bg-bb-dark px-4 py-3 flex items-center gap-3 flex-wrap">
                    <PrizeIcon icon={prize.icon} size={36} />
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium">{prize.name}</p>
                      <Badge
                        label={prize.type === 'TEAM' ? 'Team' : 'Player'}
                        cls={prize.type === 'TEAM' ? 'border-blue-700/50 text-blue-400 bg-blue-900/10' : 'border-amber-700/50 text-amber-400 bg-amber-900/10'}
                      />
                    </div>

                    <div className="ml-auto flex items-center gap-2 flex-wrap justify-end">
                      {award ? (
                        <>
                          <span className="text-bb-gold text-sm font-medium">{winnerLabel(award)}</span>
                          <form action={removeAward}>
                            <input type="hidden" name="id" value={award.id} />
                            <button type="submit" className={btnCls('danger')}>Remove</button>
                          </form>
                        </>
                      ) : (
                        <form action={awardPrize} className="flex gap-2 items-center">
                          <input type="hidden" name="prizeTypeId"  value={prize.id} />
                          <input type="hidden" name="tournamentId" value={selectedTournament} />

                          {prize.type === 'TEAM' ? (
                            <>
                              <input type="hidden" name="teamPlayerId" value="" />
                              <select name="teamId" required className={inputCls('text-xs')}>
                                <option value="">— Select team —</option>
                                {tTeams.map((team) => (
                                  <option key={team.id} value={team.id}>{team.name}</option>
                                ))}
                              </select>
                            </>
                          ) : (
                            <>
                              <input type="hidden" name="teamId" value="" />
                              <select name="teamPlayerId" required className={inputCls('text-xs')}>
                                <option value="">— Select player —</option>
                                {tTeams.map((team) => (
                                  <optgroup key={team.id} label={team.name}>
                                    {team.players.map((p) => (
                                      <option key={p.id} value={p.id}>
                                        {p.name ?? p.playerType.name}
                                      </option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </>
                          )}

                          <button type="submit" className={btnCls('primary')}>Award</button>
                        </form>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )
        })()}
      </section>
    </div>
  )
}
