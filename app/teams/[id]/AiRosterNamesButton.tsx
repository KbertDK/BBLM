'use client'

import { useState, useTransition } from 'react'
import { generateMissingPlayerNames } from './actions'

interface Props {
  teamId: string
}

export default function AiRosterNamesButton({ teamId }: Props) {
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError]   = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleGenerate() {
    setError(null)
    setStatus(null)
    startTransition(async () => {
      const result = await generateMissingPlayerNames(teamId)
      if ('error' in result) setError(result.error)
      else if (result.count === 0) setStatus('Nothing to name.')
      else setStatus(`Named ${result.count} player${result.count === 1 ? '' : 's'}.`)
    })
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        title="Name missing roster players with AI"
        onClick={handleGenerate}
        disabled={isPending}
        className="inline-flex items-center justify-center w-7 h-7 rounded-sm border border-bb-border/60 text-bb-muted/60 hover:border-bb-gold hover:text-bb-gold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isPending ? <Spinner /> : <BrainIcon />}
      </button>

      {status && <span className="text-xs text-bb-muted">{status}</span>}
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
