'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createTeam } from './actions'

// ── Types ────────────────────────────────────────────────────────────────────

type RaceOption = { id: string; name: string }

type RuleSetInfo = {
  name: string
  startIncome: number
  numberOfPlayers: number
  gameType: string
}

type LeagueOption = {
  id: string
  name: string
  season: number
  ruleSet: RuleSetInfo
}

type Skill = { name: string; category: string }

type PlayerTypeOption = {
  id: string
  name: string
  cost: number
  maxCount: number
  ma: number
  st: number
  ag: number
  av: number
  skillRollNormal: string
  skillRollDouble: string
  startingSkills: Skill[]
}

interface Props {
  races:              RaceOption[]
  leagues:            LeagueOption[]
  playerTypes:        PlayerTypeOption[]
  preselectedRaceId?: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  G: 'text-blue-300 border-blue-300/30 bg-blue-300/5',
  A: 'text-green-300 border-green-300/30 bg-green-300/5',
  P: 'text-yellow-300 border-yellow-300/30 bg-yellow-300/5',
  S: 'text-red-300 border-red-300/30 bg-red-300/5',
  M: 'text-purple-300 border-purple-300/30 bg-purple-300/5',
  E: 'text-bb-crimson-bright border-bb-crimson-bright/30 bg-bb-crimson/5',
}

function inputCls(extra = '') {
  return `w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40 ${extra}`
}

function fmt(n: number) {
  return n.toLocaleString('en')
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TeamCreatorForm({ races, leagues, playerTypes, preselectedRaceId }: Props) {
  const router = useRouter()

  const [leagueId,  setLeagueId]  = useState('')
  const [teamName,  setTeamName]  = useState('')
  const [roster,    setRoster]    = useState<Record<string, number>>({})

  // Reset roster whenever race changes (navigating reloads the component anyway,
  // but guard against stale state on client-side race switch)
  const handleRaceChange = (raceId: string) => {
    setRoster({})
    router.push(raceId ? `/teams/new?raceId=${raceId}` : '/teams/new')
  }

  const handleLeagueChange = (id: string) => {
    setLeagueId(id)
    setRoster({}) // reset roster when league (and thus budget) changes
  }

  const selectedLeague = leagues.find((l) => l.id === leagueId)
  const ruleSet        = selectedLeague?.ruleSet

  const spent        = playerTypes.reduce((s, pt) => s + (roster[pt.id] ?? 0) * pt.cost, 0)
  const totalPlayers = Object.values(roster).reduce((a, b) => a + b, 0)
  const remaining    = ruleSet ? ruleSet.startIncome - spent : 0
  const maxPlayers   = ruleSet?.numberOfPlayers ?? 0

  const add = (ptId: string, ptCost: number, ptMax: number) => {
    setRoster((prev) => ({ ...prev, [ptId]: (prev[ptId] ?? 0) + 1 }))
  }

  const remove = (ptId: string) => {
    setRoster((prev) => ({ ...prev, [ptId]: Math.max(0, (prev[ptId] ?? 0) - 1) }))
  }

  const rosterJson = JSON.stringify(
    Object.entries(roster)
      .filter(([, c]) => c > 0)
      .map(([playerTypeId, count]) => ({ playerTypeId, count }))
  )

  const hasRace    = !!preselectedRaceId
  const hasLeague  = !!leagueId && !!ruleSet
  const canSubmit  = hasRace && hasLeague && teamName.trim().length > 0 && totalPlayers > 0

  const pctSpent = ruleSet ? Math.min(100, Math.round((spent / ruleSet.startIncome) * 100)) : 0

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14 space-y-8">

        {/* Page header */}
        <div>
          <h1 className="font-heading text-3xl font-black text-bb-gold tracking-widest uppercase mb-1">
            Recruit a Team
          </h1>
          <p className="text-bb-muted text-sm">Choose your race, pick a league, and build your roster.</p>
        </div>

        {/* ── Step 1: Setup ── */}
        <div className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-5">
          <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">
            1 · Setup
          </h2>

          {/* Race */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
              Race <span className="text-bb-crimson-bright">*</span>
            </label>
            <select
              value={preselectedRaceId ?? ''}
              onChange={(e) => handleRaceChange(e.target.value)}
              className={inputCls()}
            >
              <option value="">— Select a race —</option>
              {races.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* League */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
              League <span className="text-bb-crimson-bright">*</span>
            </label>
            {leagues.length === 0 ? (
              <p className="text-bb-muted/50 text-sm italic">
                No leagues with an active rule set are available. Ask your commissioner to set one up.
              </p>
            ) : (
              <>
                <select
                  value={leagueId}
                  onChange={(e) => handleLeagueChange(e.target.value)}
                  className={inputCls()}
                >
                  <option value="">— Select a league —</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>{l.name} — Season {l.season}</option>
                  ))}
                </select>
                {ruleSet && (
                  <p className="text-bb-muted/50 text-xs">
                    Rule set: {ruleSet.name} · Budget: {fmt(ruleSet.startIncome)} gp · Max players: {ruleSet.numberOfPlayers}
                  </p>
                )}
              </>
            )}
          </div>

          {/* Team name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
              Team Name <span className="text-bb-crimson-bright">*</span>
            </label>
            <input
              type="text"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
              placeholder="Enter your team name"
              className={inputCls()}
            />
          </div>
        </div>

        {/* ── Step 2: Roster ── */}
        {!hasRace && (
          <div className="bg-bb-dark border border-bb-border rounded-sm p-6 text-center">
            <p className="text-bb-muted/50 text-sm italic">Select a race above to see available player types.</p>
          </div>
        )}

        {hasRace && !hasLeague && playerTypes.length > 0 && (
          <div className="bg-bb-dark border border-bb-border rounded-sm p-6 text-center">
            <p className="text-bb-muted/50 text-sm italic">Select a league above to enable player hiring.</p>
          </div>
        )}

        {hasRace && hasLeague && (
          <div className="space-y-4">
            <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">
              2 · Hire Players
            </h2>

            {/* Budget bar */}
            <div className="bg-bb-dark border border-bb-border rounded-sm p-4 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-bb-muted uppercase tracking-widest">Remaining budget</span>
                <span className={remaining < 0 ? 'text-bb-crimson-bright font-bold' : 'text-bb-gold font-bold'}>
                  {fmt(remaining)} / {fmt(ruleSet!.startIncome)} gp
                </span>
              </div>
              <div className="h-1.5 bg-bb-darker rounded-full overflow-hidden">
                <div
                  className="h-full bg-bb-gold rounded-full transition-all duration-200"
                  style={{ width: `${pctSpent}%` }}
                />
              </div>
              <div className="flex items-center justify-between text-xs text-bb-muted">
                <span>{fmt(spent)} gp spent</span>
                <span className={totalPlayers >= maxPlayers ? 'text-bb-crimson-bright font-bold' : ''}>
                  {totalPlayers} / {maxPlayers} players
                </span>
              </div>
            </div>

            {/* Player type table */}
            <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/40">
              {/* Header */}
              <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto_auto] text-xs font-heading tracking-widest uppercase text-bb-muted/60 bg-bb-darker border-b border-bb-border px-4 py-3 gap-3">
                <span>Position</span>
                <span className="text-right w-20">Cost</span>
                <span className="text-center w-8">MA</span>
                <span className="text-center w-8">ST</span>
                <span className="text-center w-8">AG</span>
                <span className="text-center w-8">AV</span>
                <span className="w-40">Skills</span>
                <span className="text-center w-24">Hired</span>
                <span className="w-16" />
              </div>

              {playerTypes.length === 0 ? (
                <p className="text-bb-muted/40 text-sm italic px-4 py-6 text-center">No player types for this race yet.</p>
              ) : (
                playerTypes.map((pt, i) => {
                  const count  = roster[pt.id] ?? 0
                  const canAdd = count < pt.maxCount && totalPlayers < maxPlayers && remaining >= pt.cost
                  const canSub = count > 0

                  return (
                    <div
                      key={pt.id}
                      className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto_auto_auto_auto] items-center px-4 py-3 gap-3 border-b border-bb-border last:border-0 ${i % 2 !== 0 ? 'bg-white/[0.02]' : ''}`}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold text-sm text-white leading-tight">{pt.name}</div>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {pt.startingSkills.map((s) => (
                            <span key={s.name} className={`text-xs px-1 py-0.5 rounded-sm border ${CAT_COLOR[s.category] ?? ''}`}>
                              {s.name}
                            </span>
                          ))}
                        </div>
                      </div>
                      <span className="text-right text-sm text-bb-gold font-mono w-20">{fmt(pt.cost)}</span>
                      <span className="text-center text-sm font-bold text-white w-8">{pt.ma}</span>
                      <span className="text-center text-sm font-bold text-white w-8">{pt.st}</span>
                      <span className="text-center text-sm font-bold text-white w-8">{pt.ag}</span>
                      <span className="text-center text-sm font-bold text-white w-8">{pt.av}</span>
                      <div className="w-40">
                        <div className="text-xs text-bb-muted/50 font-mono">
                          <span className="text-green-300/70">{pt.skillRollNormal}</span>
                          {' / '}
                          <span className="text-yellow-300/70">{pt.skillRollDouble}</span>
                        </div>
                      </div>
                      {/* Count + controls */}
                      <div className="flex items-center gap-1.5 w-24 justify-center">
                        <button
                          type="button"
                          onClick={() => remove(pt.id)}
                          disabled={!canSub}
                          className="w-6 h-6 flex items-center justify-center border border-bb-border text-bb-muted rounded-sm hover:border-bb-muted hover:text-white transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-sm font-bold"
                        >
                          −
                        </button>
                        <span className="text-sm font-heading font-bold text-white w-10 text-center">
                          {count} / {pt.maxCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => add(pt.id, pt.cost, pt.maxCount)}
                          disabled={!canAdd}
                          className="w-6 h-6 flex items-center justify-center border border-bb-border text-bb-muted rounded-sm hover:border-bb-gold hover:text-bb-gold transition-colors disabled:opacity-25 disabled:cursor-not-allowed text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                      <div className="w-16">
                        {count > 0 && (
                          <span className="text-xs text-bb-muted/50">
                            {fmt(count * pt.cost)} gp
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* ── Submit ── */}
        {hasRace && hasLeague && (
          <form action={createTeam}>
            <input type="hidden" name="name"      value={teamName} />
            <input type="hidden" name="raceId"    value={preselectedRaceId ?? ''} />
            <input type="hidden" name="leagueId"  value={leagueId} />
            <input type="hidden" name="roster"    value={rosterJson} />
            <button
              type="submit"
              disabled={!canSubmit}
              className="w-full bg-bb-crimson hover:bg-bb-crimson-bright disabled:opacity-40 disabled:cursor-not-allowed text-white font-heading font-bold uppercase tracking-widest text-sm py-3 px-6 rounded-sm transition-colors"
            >
              {canSubmit
                ? `Recruit Team — ${totalPlayers} player${totalPlayers !== 1 ? 's' : ''} · ${fmt(spent)} gp`
                : 'Complete setup and add at least one player'}
            </button>
          </form>
        )}

      </div>
    </div>
  )
}
