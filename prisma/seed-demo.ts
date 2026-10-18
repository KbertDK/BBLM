// Fake sample league/teams/coaches/matches/news for local development and demos only.
// Do NOT run this against staging or production — it creates coach accounts that all
// share the password "password123". Run manually: `npx ts-node prisma/seed-demo.ts`
// (requires `npx prisma db seed` to have already run, for races/player types to exist).
import { PrismaClient, MatchStatus } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const existing = await prisma.league.findFirst({ where: { name: 'The Reikland Rumble League' } })
  if (existing) {
    console.log('Demo league already exists — skipping.')
    return
  }

  const raceByName: Record<string, { id: string }> = Object.fromEntries(
    (await prisma.race.findMany({ select: { id: true, name: true } })).map((r) => [r.name, r]),
  )
  if (!raceByName['Orc'] || !raceByName['Skaven'] || !raceByName['Human']) {
    throw new Error('Core races not found — run `npx prisma db seed` first.')
  }

  const league = await prisma.league.create({
    data: { name: 'The Reikland Rumble League' },
  })

  const season = await prisma.season.create({
    data: { name: 'Season 1', season: 1, status: 'ACTIVE', leagueId: league.id },
  })

  await prisma.division.create({
    data: { name: 'Premier Division', seasonId: season.id },
  })

  const defaultHash = await bcrypt.hash('password123', 10)

  const [grimtusk, skavenslick, aldric] = await Promise.all([
    prisma.coach.create({ data: { name: 'Grimtusk Ironjaw',    email: 'grimtusk@greentide.bb', passwordHash: defaultHash, role: 'ADMIN'  } }),
    prisma.coach.create({ data: { name: 'Skavenslick Ratbane', email: 'slick@ratrunners.bb',   passwordHash: defaultHash, role: 'COMMISH' } }),
    prisma.coach.create({ data: { name: 'Aldric the Bold',     email: 'aldric@reavers.bb',     passwordHash: defaultHash, role: 'COACH'  } }),
  ])

  const [greenTide, ratrunners, reavers] = await Promise.all([
    prisma.team.create({ data: { name: 'Da Green Tide',      raceId: raceByName['Orc'].id,   coachId: grimtusk.id,   leagueId: league.id, wins: 3, draws: 1, losses: 1 } }),
    prisma.team.create({ data: { name: 'The Ratrunners',     raceId: raceByName['Skaven'].id, coachId: skavenslick.id, leagueId: league.id, wins: 4, draws: 0, losses: 1 } }),
    prisma.team.create({ data: { name: 'Reikland Reavers',   raceId: raceByName['Human'].id,  coachId: aldric.id,     leagueId: league.id, wins: 2, draws: 2, losses: 1 } }),
  ])

  const now = new Date()
  const daysAgo  = (n: number) => new Date(now.getTime() - n * 86400000)
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86400000)

  await prisma.match.createMany({
    data: [
      { leagueId: league.id, homeTeamId: greenTide.id,  awayTeamId: reavers.id,    scheduledAt: daysAgo(7),      status: MatchStatus.COMPLETED, round: 1, homeScore: 2, awayScore: 1 },
      { leagueId: league.id, homeTeamId: ratrunners.id, awayTeamId: reavers.id,    scheduledAt: daysAgo(3),      status: MatchStatus.COMPLETED, round: 1, homeScore: 3, awayScore: 0 },
      { leagueId: league.id, homeTeamId: ratrunners.id, awayTeamId: greenTide.id,  scheduledAt: now,             status: MatchStatus.LIVE,      round: 2, homeScore: 1, awayScore: 1 },
      { leagueId: league.id, homeTeamId: reavers.id,    awayTeamId: greenTide.id,  scheduledAt: daysFromNow(3),  status: MatchStatus.SCHEDULED, round: 3, homeScore: null, awayScore: null },
      { leagueId: league.id, homeTeamId: greenTide.id,  awayTeamId: ratrunners.id, scheduledAt: daysFromNow(7),  status: MatchStatus.SCHEDULED, round: 3, homeScore: null, awayScore: null },
      { leagueId: league.id, homeTeamId: reavers.id,    awayTeamId: ratrunners.id, scheduledAt: daysFromNow(10), status: MatchStatus.SCHEDULED, round: 4, homeScore: null, awayScore: null },
    ],
  })

  await prisma.newsPost.createMany({
    data: [
      {
        title: 'Season 1 Kicks Off with Brutal Opening Round',
        body: "The inaugural season of the Reikland Rumble League exploded onto the pitch with a weekend of savage action that left fans breathless and apothecaries busy. Da Green Tide crushed the Reikland Reavers 2-1 in a match that Commissioner Volkar called 'exactly the kind of carnage we hoped for.' Three players were carted off in stretchers, and the crowd loved every second of it. Grimtusk Ironjaw's boys showed they mean business this season, with their star Blitzer racking up two touchdowns and a casualty in the opening fixture. 'We iz da strongest,' Grimtusk commented after the match, wiping blood — presumably not his own — from his tusks.",
        authorId: grimtusk.id,
        createdAt: daysAgo(6),
      },
      {
        title: "Ratrunners' Skavenslick Claims No Foul Play in Last Match",
        body: "Skaven coach Skavenslick Ratbane has vigorously denied allegations that his team employed illicit tactics during their 3-0 demolition of the Reikland Reavers, despite three separate referee reviews flagging suspicious activity near the opposition dugout. 'We iz fast, yes-yes, but we play clean,' the twitchy coach insisted, his eyes darting nervously. 'Those bites are from... training accidents.' The league has announced a formal inquiry, though Commissioner Volkar privately admitted that the Ratrunners' dominance was 'quite impressive, whatever the method.' The Reavers' coach Aldric the Bold has filed an official protest, calling the match 'an embarrassment to the sport and to human dignity.'",
        authorId: skavenslick.id,
        createdAt: daysAgo(2),
      },
      {
        title: 'Rookie Thrower Sets New League Completion Record',
        body: "Reikland Reavers quarterback Stefan 'Steadyhands' Müller made history last week by setting a new league record for completion percentage in a single half — a feat made all the more remarkable given that his team lost 3-0. 'The boy can throw, no question,' admitted opposing coach Skavenslick. 'We just made sure no one was there to catch it.' Müller, playing only his third professional match, completed 8 of 9 passes for 160 yards before being knocked unconscious in the final quarter. He has been cleared to play in this week's fixture and is reportedly 'excited to get back out there,' which team physicians consider either inspiring or deeply concerning.",
        authorId: aldric.id,
        createdAt: daysAgo(1),
      },
      {
        title: 'League Commissioner Announces Playoff Format',
        body: "Commissioner Volkar Steinhammer unveiled the Reikland Rumble League's playoff structure today, confirming that the top two teams after the regular season will compete in a single-match Grand Final for the coveted Reikland Skull Trophy — a genuine skull, former owner unspecified. 'We want the most violent teams to get the most violent prize,' Steinhammer explained. He also confirmed that the league will introduce a 'Player of the Season' award, judged on a combined score of touchdowns and casualties caused. 'We reward excellence in all its forms,' he noted. The announcement was well received, particularly by Grimtusk Ironjaw, who reportedly began practicing his trophy speech — or, as Orcish linguistics experts noted, his victory roar.",
        authorId: grimtusk.id,
        createdAt: daysAgo(0),
      },
    ],
  })

  console.log('Demo data seeded: 1 league, 3 teams, 3 coaches (password: password123), 6 matches, 4 news posts.')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
