'use client'

import { useState } from 'react'
import Link from 'next/link'
import { logoutAction } from '@/app/auth/login/actions'

interface Props {
  navLinks:    { href: string; label: string }[]
  extraLinks:  { href: string; label: string; highlight?: boolean }[]
  sessionName: string | null
  isLoggedIn:  boolean
}

function HamburgerIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  )
}

export default function MobileNavClient({ navLinks, extraLinks, sessionName, isLoggedIn }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Hamburger button — only visible below md */}
      <button
        onClick={() => setOpen(!open)}
        className="flex md:hidden items-center justify-center w-9 h-9 rounded-sm border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted transition-colors"
        aria-label={open ? 'Close menu' : 'Open menu'}
        aria-expanded={open}
      >
        {open ? <XIcon /> : <HamburgerIcon />}
      </button>

      {/* Mobile drawer — drops below the header */}
      {open && (
        <div className="md:hidden absolute top-full left-0 right-0 bg-bb-darker border-b border-bb-gold/30 z-40 shadow-xl">
          <nav className="flex flex-col divide-y divide-bb-border/40 px-4 py-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className="py-3 text-sm font-heading uppercase tracking-widest text-bb-muted hover:text-bb-gold transition-colors"
              >
                {label}
              </Link>
            ))}
            {extraLinks.map(({ href, label, highlight }) => (
              <Link
                key={href}
                href={href}
                onClick={() => setOpen(false)}
                className={`py-3 text-sm font-heading uppercase tracking-widest transition-colors ${
                  highlight
                    ? 'text-bb-crimson-bright hover:text-white'
                    : 'text-bb-muted hover:text-bb-gold'
                }`}
              >
                {label}
              </Link>
            ))}
            <div className="py-3">
              {isLoggedIn ? (
                <div className="flex items-center justify-between gap-3">
                  <Link
                    href="/profile"
                    onClick={() => setOpen(false)}
                    className="text-xs text-bb-muted hover:text-bb-gold transition-colors truncate"
                  >
                    {sessionName}
                  </Link>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="text-xs font-medium uppercase tracking-widest px-3 py-1.5 border border-bb-border rounded-sm text-bb-muted hover:text-white hover:border-bb-muted transition-colors"
                    >
                      Logout
                    </button>
                  </form>
                </div>
              ) : (
                <Link
                  href="/auth/login"
                  onClick={() => setOpen(false)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-widest text-bb-gold border border-bb-gold/40 rounded-sm hover:bg-bb-gold/10 hover:border-bb-gold transition-colors"
                >
                  Coach Login
                </Link>
              )}
            </div>
          </nav>
        </div>
      )}
    </>
  )
}
