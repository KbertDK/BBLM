import { ReactNode } from 'react'
import clsx from 'clsx'

interface GrimdarkCardProps {
  children: ReactNode
  className?: string
}

export default function GrimdarkCard({ children, className }: GrimdarkCardProps) {
  return (
    <div
      className={clsx(
        'bg-bb-dark border border-bb-gold/20 rounded-sm shadow-lg shadow-black/50',
        className
      )}
    >
      {children}
    </div>
  )
}
