import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default function TeamPage({ params }: Props) {
  return (
    <div className="min-h-screen bg-bb-navy flex flex-col items-center justify-center gap-6 px-4">
      <div className="font-heading text-bb-gold/50 text-5xl font-black">🏟</div>
      <h1 className="font-heading text-bb-gold text-3xl font-bold tracking-widest uppercase text-center">
        Team Roster
      </h1>
      <p className="text-bb-muted text-center max-w-sm">
        Full team detail — roster, stats, match history — coming in Phase 2.
      </p>
      <p className="text-bb-border text-xs font-mono">Team ID: {params.id}</p>
      <Link
        href="/"
        className="px-6 py-3 border border-bb-gold/40 text-bb-gold text-sm font-heading tracking-widest uppercase hover:bg-bb-gold/10 transition-colors rounded-sm"
      >
        Back to League
      </Link>
    </div>
  )
}
