'use client'

import { useActionState } from 'react'
import { generateResetLink } from './coach-actions'

const btn = 'text-xs font-medium uppercase tracking-widest px-3 py-1.5 rounded-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted'
const inp = 'bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60'

export default function ResetLinkButton({ coachId }: { coachId: string }) {
  const [state, action, pending] = useActionState(generateResetLink, null)

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="id" value={coachId} />
      <div className="flex gap-1.5">
        <button type="submit" disabled={pending} className={btn}>
          {pending ? 'Generating…' : 'Reset Link'}
        </button>
      </div>
      {state?.url && (
        <div className="mt-1 space-y-1">
          <p className="text-bb-muted text-xs">Copy this link and send it to the coach. Valid for 1 hour.</p>
          <div className="flex gap-1.5 items-center">
            <input
              readOnly
              value={`${typeof window !== 'undefined' ? window.location.origin : ''}${state.url}`}
              className={`${inp} flex-1 text-xs text-bb-gold/80 select-all`}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}${state.url}`
                navigator.clipboard.writeText(url)
              }}
              className={btn}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
