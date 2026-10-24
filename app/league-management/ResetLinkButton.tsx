'use client'

import { useActionState } from 'react'
import { generateResetLink } from './coach-actions'

export default function ResetLinkButton({ coachId, btnCls, inputCls }: {
  coachId:  string
  btnCls:   (variant?: 'ghost' | 'primary' | 'danger' | 'muted', extra?: string) => string
  inputCls: string
}) {
  const [state, action, pending] = useActionState(generateResetLink, null)

  return (
    <form action={action} className="space-y-1.5">
      <input type="hidden" name="id" value={coachId} />
      <div className="flex gap-1.5">
        <button type="submit" disabled={pending} className={btnCls('ghost')}>
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
              className={`${inputCls} flex-1 text-xs text-bb-gold/80 select-all`}
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              type="button"
              onClick={() => {
                const url = `${window.location.origin}${state.url}`
                navigator.clipboard.writeText(url)
              }}
              className={btnCls('ghost')}
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </form>
  )
}
