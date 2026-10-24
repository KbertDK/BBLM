'use client'

import { useActionState } from 'react'
import { verifyMfaAction } from './actions'

export default function MfaPage() {
  const [state, action, pending] = useActionState(verifyMfaAction, null)

  return (
    <div className="min-h-screen bg-bb-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-black text-bb-gold tracking-widest uppercase mb-2">
            Two-Factor Auth
          </h1>
          <p className="text-bb-muted text-sm">
            Enter the 6-digit code from your authenticator app.
          </p>
        </div>

        <form action={action} className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
              Authenticator Code
            </label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              autoFocus
              placeholder="000000"
              className="w-full bg-bb-darker border border-bb-border text-white text-center text-2xl tracking-[0.5em] px-3 py-3 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/30 placeholder:tracking-normal"
            />
          </div>

          {state?.error && (
            <p className="text-bb-crimson-bright text-xs text-center">{state.error}</p>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-bb-crimson hover:bg-bb-crimson-bright disabled:opacity-50 text-white font-heading font-bold uppercase tracking-widest text-sm py-3 px-6 rounded-sm transition-colors"
          >
            {pending ? 'Verifying…' : 'Verify'}
          </button>

          <p className="text-center">
            <a href="/auth/login" className="text-bb-muted/50 hover:text-bb-muted text-xs transition-colors">
              ← Back to login
            </a>
          </p>
        </form>
      </div>
    </div>
  )
}
