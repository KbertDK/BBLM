import prisma from '@/lib/prisma'
import { getLatestNews } from '@/lib/queries/news'
import { getUpcomingMatches, getLiveMatches, getLatestResults } from '@/lib/queries/matches'
import { getTeamsByCoach } from '@/lib/queries/teams'
import { getSession } from '@/lib/auth'
import NewsSection from '@/components/news/NewsSection'
import MatchesPanel from '@/components/matches/MatchesPanel'
import TeamQuickAccess from '@/components/teams/TeamQuickAccess'
import SponsorBanner from '@/components/adverts/SponsorBanner'
import LeagueFilter from '@/components/LeagueFilter'

export const revalidate = 0

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ leagueId?: string }>
}) {
  const { leagueId: paramLeagueId } = await searchParams
  const session = await getSession()

  // Resolve active league: URL param → user's primary league → undefined (all)
  let activeLeagueId = paramLeagueId
  if (!activeLeagueId && session) {
    const coach = await prisma.coach.findUnique({
      where:  { id: session.coachId },
      select: { primaryLeagueId: true },
    })
    activeLeagueId = coach?.primaryLeagueId ?? undefined
  }

  const [news, upcoming, live, results, myTeams, leagues] = await Promise.all([
    getLatestNews(),
    getUpcomingMatches(activeLeagueId),
    getLiveMatches(activeLeagueId),
    getLatestResults(activeLeagueId),
    session ? getTeamsByCoach(session.coachId) : Promise.resolve(null),
    prisma.league.findMany({
      where:   { isHidden: false },
      orderBy: { createdAt: 'asc' },
      select:  { id: true, name: true, season: true },
    }),
  ])

  const activeLeague = leagues.find((l) => l.id === activeLeagueId)

  return (
    <div className="min-h-screen bg-grimdark-gradient">
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-bb-crimson/5 to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 text-center relative">
          {leagues.length > 0 && (
            <div className="inline-flex items-center gap-2 mb-6">
              <LeagueFilter leagues={leagues} activeId={activeLeagueId} />
            </div>
          )}
          <h1 className="font-heading text-5xl md:text-7xl font-black text-white mb-4 tracking-tight leading-none">
            The Reikland<br />
            <span className="text-bb-gold">Rumble League</span>
          </h1>
          <p className="text-bb-muted text-lg max-w-xl mx-auto leading-relaxed">
            Where bones crack, legends rise, and the crowd always wants more.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 flex flex-col gap-20">
        <MatchesPanel upcoming={upcoming} live={live} results={results} />
        <NewsSection posts={news} />
        <TeamQuickAccess teams={myTeams} />
        <SponsorBanner />
      </div>
    </div>
  )
}
