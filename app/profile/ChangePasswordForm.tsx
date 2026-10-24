'use client'

import { useActionState } from 'react'
import { changePassword } from './actions'

const inputCls = 'w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40'

export default function ChangePasswordForm() {
  const [state, action, pending] = useActionState(changePassword, null)

  if (state?.success) {
    return (
      <div className="bg-bb-dark border border-bb-border rounded-sm p-6">
        <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase mb-4">
          Change Password
        </h2>
        <p className="text-green-400 text-sm">Password updated successfully.</p>
      </div>
    )
  }

  return (
    <form action={action} className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-4">
      <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">
        Change Password
      </h2>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
          Current Password
        </label>
        <input name="current" type="password" required placeholder="Your current password" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
          New Password
        </label>
        <input name="next" type="password" required minLength={8} placeholder="At least 8 characters" className={inputCls} />
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
          Confirm New Password
        </label>
        <input name="confirm" type="password" required minLength={8} placeholder="Repeat new password" className={inputCls} />
      </div>

      {state?.error && (
        <p className="text-bb-crimson-bright text-xs">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="bg-bb-crimson hover:bg-bb-crimson-bright disabled:opacity-50 text-white font-heading font-bold uppercase tracking-widest text-xs py-2 px-5 rounded-sm transition-colors"
      >
        {pending ? 'Saving…' : 'Update Password'}
      </button>
    </form>
  )
}
