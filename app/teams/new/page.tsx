import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { TeamCreatorForm } from './TeamCreatorForm'

export const dynamic = 'force-dynamic'

export default async function NewTeamPage({
  searchParams,
}: {
  searchParams: { raceId?: string }
}) {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const raceId = searchParams.raceId

  const [races, leaguesRaw, playerTypes] = await Promise.all([
    prisma.race.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }),
    prisma.league.findMany({
      where: {
        isHidden: false,
        status:   { not: 'ENDED' },
        ruleSet:  { status: 'ACTIVE' },
      },
      include: {
        ruleSet: {
          select: { name: true, startIncome: true, numberOfPlayers: true, gameType: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    raceId
      ? prisma.playerType.findMany({
          where:   { raceId },
          orderBy: { cost: 'desc' },
          include: { startingSkills: { select: { name: true, category: true } } },
        })
      : Promise.resolve([]),
  ])

  // Narrow the type: filter guarantees ruleSet is non-null
  const leagues = leaguesRaw
    .filter((l): l is typeof l & { ruleSet: NonNullable<typeof l.ruleSet> } => l.ruleSet !== null)
    .map((l) => ({
      id:     l.id,
      name:   l.name,
      season: l.season,
      ruleSet: {
        name:            l.ruleSet.name,
        startIncome:     l.ruleSet.startIncome,
        numberOfPlayers: l.ruleSet.numberOfPlayers,
        gameType:        l.ruleSet.gameType as string,
      },
    }))

  return (
    <TeamCreatorForm
      races={races}
      leagues={leagues}
      playerTypes={playerTypes}
      preselectedRaceId={raceId}
    />
  )
}
