import Link from 'next/link'
import { getLeagueTeams } from '@/lib/queries/teams'

export const revalidate = 60

const raceColors: Record<string, string> = {
  Orcs:   'text-green-400 border-green-400/30 bg-green-400/5',
  Skaven: 'text-amber-400 border-amber-400/30 bg-amber-400/5',
  Humans: 'text-blue-400 border-blue-400/30 bg-blue-400/5',
}

export default async function TeamsPage() {
  const teams = await getLeagueTeams()

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">

        <div className="text-center mb-10">
          <div className="flex items-center gap-4 justify-center mb-2">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent to-bb-gold/60 max-w-32" />
            <h1 className="font-heading text-3xl font-bold text-bb-gold tracking-widest uppercase">
              League Teams
            </h1>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent to-bb-gold/60 max-w-32" />
          </div>
          <p className="text-bb-muted text-sm tracking-wide mt-1">
            {teams.length} team{teams.length !== 1 ? 's' : ''} competing this season
          </p>
        </div>

        <div className="bg-bb-dark border border-bb-gold/20 rounded-sm overflow-hidden shadow-xl shadow-black/50 mb-8">
          <div className="grid grid-cols-12 text-xs font-heading tracking-widest uppercase text-bb-muted/60 bg-bb-darker border-b border-bb-border px-5 py-3 gap-2">
            <span className="col-span-1 text-center">#</span>
            <span className="col-span-4">Team</span>
            <span className="col-span-3">Coach</span>
            <span className="col-span-1 text-center">W</span>
            <span className="col-span-1 text-center">D</span>
            <span className="col-span-1 text-center">L</span>
            <span className="col-span-1 text-center">Pts</span>
          </div>

          {teams.map((team, i) => {
            const pts = team.wins * 3 + team.draws
            const raceStyle = raceColors[team.race] ?? 'text-bb-muted border-bb-muted/30 bg-bb-muted/5'
            const isFirst = i === 0

            return (
              <Link
                key={team.id}
                href={`/teams/${team.id}`}
                className="grid grid-cols-12 items-center px-5 py-4 gap-2 border-b border-bb-border last:border-0 hover:bg-bb-gold/5 transition-colors group"
              >
                <span className={`col-span-1 text-center font-heading font-bold text-lg ${isFirst ? 'text-bb-gold' : 'text-bb-muted/40'}`}>
                  {i + 1}
                </span>

                <div className="col-span-4 flex flex-col gap-1">
                  <span className="font-heading font-bold text-white group-hover:text-bb-gold transition-colors text-sm leading-tight">
                    {team.name}
                  </span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-sm border w-fit ${raceStyle}`}>
                    {team.race}
                  </span>
                </div>

                <span className="col-span-3 text-sm text-bb-muted truncate">{team.coachName}</span>
                <span className="col-span-1 text-center text-sm font-semibold text-green-400">{team.wins}</span>
                <span className="col-span-1 text-center text-sm text-bb-muted">{team.draws}</span>
                <span className="col-span-1 text-center text-sm font-semibold text-bb-crimson-bright">{team.losses}</span>
                <span className="col-span-1 text-center font-heading font-bold text-bb-gold">{pts}</span>
              </Link>
            )
          })}
        </div>

        <div className="flex justify-center">
          <Link
            href="/teams/new"
            className="inline-flex items-center gap-2 px-6 py-3 bg-bb-crimson hover:bg-bb-crimson-bright text-white font-heading font-bold uppercase tracking-widest text-sm rounded-sm border border-bb-crimson-bright/50 transition-all shadow-lg shadow-bb-crimson/20"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Recruit a New Team
          </Link>
        </div>

      </div>
    </div>
  )
}
