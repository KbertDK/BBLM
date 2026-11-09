'use client'

import { useState, useTransition } from 'react'
import { generateTeamNameSuggestion, applyGeneratedTeamName } from './actions'

interface Props {
  teamId: string
}

export default function AiTeamNameButton({ teamId }: Props) {
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    startTransition(async () => {
      const result = await generateTeamNameSuggestion(teamId)
      if ('error' in result) setError(result.error)
      else setSuggestion(result.name)
    })
  }

  function handleApply() {
    if (!suggestion) return
    startTransition(async () => {
      const result = await applyGeneratedTeamName(teamId, suggestion)
      if (result?.error) setError(result.error)
      setSuggestion(null)
    })
  }

  return (
    <span className="inline-flex items-center gap-2 flex-wrap">
      <button
        type="button"
        title="Suggest a team name with AI"
        onClick={handleGenerate}
        disabled={isPending}
        className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-bb-border/60 text-bb-muted/60 hover:border-bb-gold hover:text-bb-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? <Spinner /> : <BrainIcon />}
      </button>

      {suggestion && (
        <span className="flex items-center gap-1.5 text-sm">
          <span className="text-bb-gold italic">{suggestion}</span>
          <button
            type="button"
            onClick={handleApply}
            disabled={isPending}
            className="text-xs font-medium uppercase tracking-widest px-2 py-1 rounded-sm border border-bb-gold/50 text-bb-gold hover:bg-bb-gold/10 transition-colors disabled:opacity-40"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={() => setSuggestion(null)}
            disabled={isPending}
            className="text-xs font-medium uppercase tracking-widest px-2 py-1 rounded-sm border border-bb-border text-bb-muted hover:text-white transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
        </span>
      )}

      {error && <span className="text-xs text-bb-crimson-bright">{error}</span>}
    </span>
  )
}

function BrainIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.5 3.5a2.5 2.5 0 0 0-2.5 2.5v.2A3 3 0 0 0 5 9v1a3 3 0 0 0-1 5.8 2.5 2.5 0 0 0 2.5 3.2h1A2.5 2.5 0 0 0 10 16.5v-10A2.5 2.5 0 0 0 9.5 3.5Z" />
      <path d="M14.5 3.5a2.5 2.5 0 0 1 2.5 2.5v.2a3 3 0 0 1 2 3.3v1a3 3 0 0 1 1 5.8 2.5 2.5 0 0 1-2.5 3.2h-1a2.5 2.5 0 0 1-2.5-2.5v-10a2.5 2.5 0 0 1 2.5-2.5Z" />
      <path d="M10 8h2m-2 4h2m-2 4h2" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  )
}
