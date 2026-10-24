'use client'

import { useActionState } from 'react'
import { setupMfa, confirmMfa, disableMfa } from './actions'

const inputCls = 'w-full bg-bb-darker border border-bb-border text-white text-sm px-3 py-2 rounded-sm focus:outline-none focus:border-bb-gold/60 placeholder:text-bb-muted/40'

export default function MfaSection({ mfaEnabled }: { mfaEnabled: boolean }) {
  const [setupState,   setupAction,   setupPending]   = useActionState(setupMfa,   null)
  const [confirmState, confirmAction, confirmPending] = useActionState(confirmMfa, null)
  const [disableState, disableAction, disablePending] = useActionState(disableMfa, null)

  // MFA was just disabled
  if (disableState?.success) {
    return (
      <div className="bg-bb-dark border border-bb-border rounded-sm p-6">
        <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase mb-4">Two-Factor Authentication</h2>
        <p className="text-green-400 text-sm">MFA has been disabled. You can re-enable it at any time.</p>
      </div>
    )
  }

  // MFA was just confirmed/enabled
  if (confirmState?.success) {
    return (
      <div className="bg-bb-dark border border-bb-border rounded-sm p-6">
        <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase mb-4">Two-Factor Authentication</h2>
        <div className="flex items-center gap-2 text-green-400 text-sm">
          <ShieldIcon />
          <span>MFA is active. Your account is protected with your authenticator app.</span>
        </div>
      </div>
    )
  }

  // MFA is currently enabled — show disable option
  if (mfaEnabled && !setupState?.qrDataUrl) {
    return (
      <form action={disableAction} className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-4">
        <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">Two-Factor Authentication</h2>
        <div className="flex items-center gap-2 text-green-400 text-sm mb-2">
          <ShieldIcon />
          <span>MFA is active</span>
        </div>
        <p className="text-bb-muted text-xs">To disable MFA, confirm your password below.</p>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">Password</label>
          <input name="password" type="password" required placeholder="Your current password" className={inputCls} />
        </div>
        {disableState?.error && <p className="text-bb-crimson-bright text-xs">{disableState.error}</p>}
        <button
          type="submit"
          disabled={disablePending}
          className="bg-bb-muted/20 hover:bg-bb-crimson/40 disabled:opacity-50 text-bb-muted hover:text-bb-crimson-bright font-heading font-bold uppercase tracking-widest text-xs py-2 px-5 rounded-sm transition-colors border border-bb-border"
        >
          {disablePending ? 'Disabling…' : 'Disable MFA'}
        </button>
      </form>
    )
  }

  // Setup was triggered — show QR code + confirm step
  if (setupState?.qrDataUrl) {
    return (
      <div className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-5">
        <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">Set Up Two-Factor Authentication</h2>

        <ol className="text-bb-muted text-xs space-y-1 list-decimal list-inside">
          <li>Install Google Authenticator, Authy, or any TOTP app on your phone.</li>
          <li>Scan the QR code below, or enter the key manually.</li>
          <li>Enter the 6-digit code your app shows to confirm.</li>
        </ol>

        {/* QR code */}
        <div className="flex justify-center">
          <img src={setupState.qrDataUrl} alt="MFA QR code" className="w-44 h-44 bg-white p-1 rounded-sm" />
        </div>

        {/* Manual key */}
        <div className="space-y-1">
          <p className="text-xs text-bb-muted uppercase tracking-widest">Manual entry key</p>
          <code className="block bg-bb-darker border border-bb-border text-bb-gold text-xs px-3 py-2 rounded-sm tracking-widest break-all select-all">
            {setupState.secret}
          </code>
        </div>

        {/* Confirm code */}
        <form action={confirmAction} className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-medium uppercase tracking-widest text-bb-muted">
              6-digit code from your app
            </label>
            <input
              name="code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              required
              autoComplete="one-time-code"
              placeholder="000000"
              className={`${inputCls} text-center text-lg tracking-[0.4em] placeholder:tracking-normal`}
            />
          </div>
          {confirmState?.error && <p className="text-bb-crimson-bright text-xs">{confirmState.error}</p>}
          <button
            type="submit"
            disabled={confirmPending}
            className="w-full bg-bb-crimson hover:bg-bb-crimson-bright disabled:opacity-50 text-white font-heading font-bold uppercase tracking-widest text-xs py-2 px-5 rounded-sm transition-colors"
          >
            {confirmPending ? 'Verifying…' : 'Activate MFA'}
          </button>
        </form>
      </div>
    )
  }

  // Default: MFA not enabled, show enable button
  return (
    <form action={setupAction} className="bg-bb-dark border border-bb-border rounded-sm p-6 space-y-4">
      <h2 className="font-heading text-sm font-bold text-bb-gold tracking-widest uppercase">Two-Factor Authentication</h2>
      <p className="text-bb-muted text-sm">
        Add an extra layer of security to your account with an authenticator app (Google Authenticator, Authy, etc.).
      </p>
      {setupState?.error && <p className="text-bb-crimson-bright text-xs">{setupState.error}</p>}
      <button
        type="submit"
        disabled={setupPending}
        className="bg-bb-crimson hover:bg-bb-crimson-bright disabled:opacity-50 text-white font-heading font-bold uppercase tracking-widest text-xs py-2 px-5 rounded-sm transition-colors"
      >
        {setupPending ? 'Generating…' : 'Enable MFA'}
      </button>
    </form>
  )
}

function ShieldIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  )
}
