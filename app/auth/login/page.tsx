'use client'

import { useActionState } from 'react'
import { loginAction } from './actions'

export default function LoginPage() {
  const [state, action, isPending] = useActionState(loginAction, null)

  return (
    <div className="min-h-screen bg-bb-navy flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm p-8 shadow-xl shadow-black/60">

          <div className="mb-8">
            <h1 className="font-heading text-2xl font-black text-bb-gold tracking-widest uppercase mb-1">
              Coach Login
            </h1>
            <p className="text-bb-muted text-xs">Sign in to manage your team</p>
          </div>

          {state?.error && (
            <div className="mb-5 px-3 py-2.5 bg-bb-crimson/20 border border-bb-crimson-bright/30 rounded-sm">
              <p className="text-bb-crimson-bright text-xs">{state.error}</p>
            </div>
          )}

          <form action={action} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-bb-muted text-xs uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="coach@example.com"
                className="w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2.5 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40 transition-colors"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-bb-muted text-xs uppercase tracking-widest mb-1.5">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                className="w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2.5 rounded-sm focus:outline-none focus:border-bb-gold/60 transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full mt-2 px-4 py-2.5 bg-bb-crimson hover:bg-bb-crimson-bright text-white text-xs font-medium uppercase tracking-widest rounded-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isPending ? 'Signing in…' : 'Enter the Dugout'}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-bb-muted/40 text-xs">
          Blood Bowl League Manager
        </p>
      </div>
    </div>
  )
}
