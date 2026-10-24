'use client'

import { useActionState, use } from 'react'
import { resetPasswordAction } from './actions'

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [state, action, pending] = useActionState(resetPasswordAction, null)

  return (
    <div className="min-h-screen bg-bb-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="font-heading text-3xl font-black text-bb-gold tracking-widest uppercase mb-2">
            Set New Password
          </h1>
          <p className="text-bb-muted text-sm">Choose a new password for your account.</p>
        </div>

        <form action={action} className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-4">
          <input type="hidden" name="token" value={token} />

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
              New Password
            </label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              autoFocus
              placeholder="At least 8 characters"
              className="w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
              Confirm Password
            </label>
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              placeholder="Repeat new password"
              className="w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40"
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
            {pending ? 'Saving…' : 'Set Password'}
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
