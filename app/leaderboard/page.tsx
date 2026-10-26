import Link from 'next/link'
import prisma from '@/lib/prisma'

export const revalidate = 0

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span className="font-heading font-black text-bb-gold text-base">1</span>
  if (rank === 2) return <span className="font-heading font-bold text-slate-300 text-sm">2</span>
  if (rank === 3) return <span className="font-heading font-bold text-amber-700 text-sm">3</span>
  return <span className="font-heading text-sm text-bb-muted/40">{rank}</span>
}

export default async function LeaderboardPage() {
  const coaches = await prisma.coach.findMany({
    where:   { isActive: true, teams: { some: {} } },
    orderBy: { eloRating: 'desc' },
    select: {
      id:        true,
      alias:     true,
      name:      true,
      eloRating: true,
      teams: {
        where:   { isActive: true },
        orderBy: { eloRating: 'desc' },
        select: { id: true, name: true, eloRating: true, wins: true, draws: true, losses: true },
      },
    },
  })

  return (
    <div className="min-h-screen bg-grimdark-gradient">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <div className="mb-10">
          <h1 className="font-heading text-4xl font-black text-bb-gold tracking-widest uppercase mb-2">
            ELO Leaderboard
          </h1>
          <p className="text-bb-muted text-sm">Coaches ranked by ELO rating across all their teams. All ratings start at 1500.</p>
        </div>

        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/40">
          {/* Header */}
          <div className="grid grid-cols-[40px_1fr_80px] text-[10px] font-heading tracking-widest uppercase text-bb-muted/50 bg-bb-darker border-b border-bb-border px-5 py-3 gap-4">
            <span className="text-center">#</span>
            <span>Coach</span>
            <span className="text-right">ELO</span>
          </div>

          {coaches.length === 0 && (
            <p className="text-bb-muted/50 text-sm italic px-5 py-8 text-center">No coaches to rank yet.</p>
          )}

          {coaches.map((coach, i) => {
            const displayName = coach.alias ?? coach.name
            return (
              <div key={coach.id} className="border-b border-bb-border/60 last:border-0">
                {/* Coach row */}
                <div className={`grid grid-cols-[40px_1fr_80px] items-center px-5 py-3.5 gap-4 ${i === 0 ? 'bg-bb-gold/5' : ''}`}>
                  <div className="text-center"><RankBadge rank={i + 1} /></div>
                  <div>
                    <span className={`font-heading font-bold text-sm ${i === 0 ? 'text-bb-gold' : 'text-white/90'}`}>
                      {displayName}
                    </span>
                  </div>
                  <div className="text-right font-heading font-black text-base text-bb-gold tabular-nums">
                    {Math.round(coach.eloRating)}
                  </div>
                </div>

                {/* Teams sub-list */}
                {coach.teams.length > 0 && (
                  <div className="bg-bb-darker/60 border-t border-bb-border/30 divide-y divide-bb-border/20">
                    {coach.teams.map((team) => (
                      <Link
                        key={team.id}
                        href={`/teams/${team.id}`}
                        className="grid grid-cols-[40px_1fr_80px] items-center px-5 py-2.5 gap-4 hover:bg-bb-gold/5 transition-colors group"
                      >
                        <div />
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs text-bb-muted/40">→</span>
                          <span className="text-xs text-bb-muted group-hover:text-bb-gold transition-colors truncate">
                            {team.name}
                          </span>
                          <span className="text-[10px] text-bb-muted/30 font-heading ml-1">
                            {team.wins}W {team.draws}D {team.losses}L
                          </span>
                        </div>
                        <div className="text-right text-xs font-heading font-bold text-bb-muted/60 tabular-nums">
                          {Math.round(team.eloRating)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
