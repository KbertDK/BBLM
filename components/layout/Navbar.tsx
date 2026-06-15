import Link from 'next/link'
import { getSession } from '@/lib/auth'
import { logoutAction } from '@/app/auth/login/actions'

const navLinks = [
  { href: '/',           label: 'Home' },
  { href: '/teams',      label: 'Teams' },
  { href: '/races',      label: 'Races' },
  { href: '/schedule',   label: 'Schedule' },
  { href: '/standings',  label: 'Standings' },
]

export default async function Navbar() {
  const session = await getSession()

  return (
    <header className="bg-bb-darker border-b border-bb-gold/30 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-9 h-9 border-2 border-bb-gold flex items-center justify-center rounded-sm bg-bb-crimson/10">
              <span className="font-heading font-black text-bb-gold text-xs leading-none">BB</span>
            </div>
            <div className="leading-tight">
              <div className="font-heading font-bold text-bb-gold text-sm tracking-widest uppercase group-hover:text-white transition-colors">
                Blood Bowl
              </div>
              <div className="text-bb-muted text-xs tracking-wider uppercase">League Manager</div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className="px-4 py-2 text-sm font-body text-bb-muted hover:text-bb-gold hover:bg-bb-gold/5 rounded-sm transition-colors tracking-wide uppercase text-xs font-medium"
              >
                {label}
              </Link>
            ))}
            {(session?.role === 'ADMIN' || session?.role === 'COMMISH') && (
              <Link
                href="/league-management"
                className="px-4 py-2 text-sm font-body text-bb-crimson-bright hover:text-white hover:bg-bb-crimson/20 rounded-sm transition-colors tracking-wide uppercase text-xs font-medium"
              >
                League Management
              </Link>
            )}
            {session?.role === 'ADMIN' && (
              <Link
                href="/data-manager"
                className="px-4 py-2 text-sm font-body text-bb-crimson-bright hover:text-white hover:bg-bb-crimson/20 rounded-sm transition-colors tracking-wide uppercase text-xs font-medium"
              >
                Data Manager
              </Link>
            )}
          </nav>

          <div className="hidden md:flex items-center gap-3">
            {session ? (
              <>
                <Link
                  href="/profile"
                  className="text-xs text-bb-muted hover:text-bb-gold transition-colors"
                >
                  Signed in as{' '}
                  <span className="text-bb-gold font-semibold">{session.alias ?? session.name}</span>
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="px-4 py-2 text-xs font-medium uppercase tracking-widest text-bb-muted border border-bb-border rounded-sm hover:text-white hover:border-bb-muted transition-colors"
                  >
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium uppercase tracking-widest text-bb-gold border border-bb-gold/40 rounded-sm hover:bg-bb-gold/10 hover:border-bb-gold transition-colors"
              >
                Coach Login
              </Link>
            )}
          </div>
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-bb-gold/50 to-transparent" />
    </header>
  )
}
