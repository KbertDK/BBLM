import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import GameOnClient from './GameOnClient'

interface PageProps {
  params: Promise<{ id: string }>
}

function computeTV(team: {
  players:          { value: number }[]
  rerolls:          number
  race:             { rerollPrice: number }
  assistantCoaches: number
  cheerleaders:     number
  fanFactor:        number
  apothecary:       boolean
}) {
  const playerValue = team.players.reduce((s, p) => s + p.value, 0)
  return Math.round(
    (playerValue +
      team.rerolls          * team.race.rerollPrice +
      team.assistantCoaches * 10000 +
      team.cheerleaders     * 10000 +
      team.fanFactor        * 10000 +
      (team.apothecary ? 50000 : 0)) /
    1000,
  )
}

export default async function GameOnPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()

  const [match, lonerSkill] = await Promise.all([
    prisma.match.findUnique({
      where: { id },
      include: {
        homeTeam: {
          select: {
            id:               true,
            name:             true,
            coachId:          true,
            raceId:           true,
            treasury:         true,
            fanFactor:        true,
            rerolls:          true,
            assistantCoaches: true,
            cheerleaders:     true,
            apothecary:       true,
            race:             { select: { name: true, rerollPrice: true } },
            players: {
              where:   { status: { in: ['ACTIVE', 'MNG'] } },
              select:  { id: true, number: true, name: true, status: true, ssp: true, value: true, playerType: { select: { name: true, ma: true, st: true, ag: true, av: true, startingSkills: { select: { name: true, skillRule: true } } } } },
              orderBy: { number: 'asc' },
            },
          },
        },
        awayTeam: {
          select: {
            id:               true,
            name:             true,
            coachId:          true,
            raceId:           true,
            treasury:         true,
            fanFactor:        true,
            rerolls:          true,
            assistantCoaches: true,
            cheerleaders:     true,
            apothecary:       true,
            race:             { select: { name: true, rerollPrice: true } },
            players: {
              where:   { status: { in: ['ACTIVE', 'MNG'] } },
              select:  { id: true, number: true, name: true, status: true, ssp: true, value: true, playerType: { select: { name: true, ma: true, st: true, ag: true, av: true, startingSkills: { select: { name: true, skillRule: true } } } } },
              orderBy: { number: 'asc' },
            },
          },
        },
      },
    }),
    prisma.skill.findFirst({ where: { name: 'Loner' }, select: { skillRule: true } }),
  ])

  if (!match) redirect('/')

  const isParticipant =
    session &&
    (session.coachId === match.homeTeam.coachId ||
     session.coachId === match.awayTeam.coachId ||
     session.role === 'COMMISH' ||
     session.role === 'ADMIN')

  if (!isParticipant) redirect('/')

  if (match.status === 'COMPLETED') {
    return (
      <div className="min-h-screen bg-bb-darker flex items-center justify-center text-white">
        <div className="text-center p-8 border border-bb-border rounded-sm bg-bb-dark max-w-sm w-full">
          <div className="text-4xl mb-4">🏆</div>
          <h1 className="font-heading text-2xl font-black text-bb-gold mb-3">Match Completed</h1>
          <p className="text-bb-muted text-sm mb-1">{match.homeTeam.name}</p>
          <p className="font-heading text-4xl font-black text-white my-2">
            {match.homeScore ?? 0} – {match.awayScore ?? 0}
          </p>
          <p className="text-bb-muted text-sm">{match.awayTeam.name}</p>
        </div>
      </div>
    )
  }

  const homeRaceName = match.homeTeam.race.name
  const awayRaceName = match.awayTeam.race.name

  const starPlayerSelect = {
    where:   { includedWithId: null, OR: [{ races: { some: {} } }, { races: { none: {} } }] as object[] },
    include: {
      skills:     { select: { name: true, skillRule: true } },
      companions: { include: { skills: { select: { name: true, skillRule: true } } } },
    },
    orderBy: { price: 'asc' as const },
  }

  // Parallel-fetch pricelist player types, mercs, and star players
  const [homePlayerTypes, awayPlayerTypes, matchMercs, homeStarPlayerRows, awayStarPlayerRows, matchStarRows] = await Promise.all([
    prisma.playerType.findMany({
      where:   { raceId: match.homeTeam.raceId },
      orderBy: { cost: 'asc' },
      include: { startingSkills: { select: { name: true, skillRule: true } } },
    }),
    prisma.playerType.findMany({
      where:   { raceId: match.awayTeam.raceId },
      orderBy: { cost: 'asc' },
      include: { startingSkills: { select: { name: true, skillRule: true } } },
    }),
    prisma.matchMerc.findMany({
      where:   { matchId: id },
      include: { playerType: { include: { startingSkills: { select: { name: true, skillRule: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
    // Star players eligible for home race OR universal (no races)
    prisma.mdStarPlayer.findMany({
      ...starPlayerSelect,
      where: {
        includedWithId: null,
        OR: [{ races: { some: { name: homeRaceName } } }, { races: { none: {} } }],
      },
    }),
    // Star players eligible for away race OR universal (no races)
    prisma.mdStarPlayer.findMany({
      ...starPlayerSelect,
      where: {
        includedWithId: null,
        OR: [{ races: { some: { name: awayRaceName } } }, { races: { none: {} } }],
      },
    }),
    prisma.matchStarPlayer.findMany({
      where:   { matchId: id },
      include: { starPlayer: { include: { skills: { select: { name: true, skillRule: true } } } } },
      orderBy: { createdAt: 'asc' },
    }),
  ])

  // Synthesise star-player lineup entries (similar to mercs)
  const homeStarLinePlayers = matchStarRows
    .filter((m) => m.side === 'home')
    .map((m) => ({
      id:             m.id,
      number:         0,
      name:           m.starPlayer.name,
      status:         'ACTIVE' as const,
      playerTypeName: 'Star Player',
      ma:             m.starPlayer.ma,
      st:             m.starPlayer.st,
      ag:             m.starPlayer.ag,
      av:             m.starPlayer.av,
      ssp:            0,
      skills:         m.starPlayer.skills.map((s) => ({ name: s.name, rule: s.skillRule })),
      isMerc:         true  as const,
      isStarPlayer:   true  as const,
      starPlayerId:   m.starPlayerId,
      mercCost:       m.price,
    }))

  const awayStarLinePlayers = matchStarRows
    .filter((m) => m.side === 'away')
    .map((m) => ({
      id:             m.id,
      number:         0,
      name:           m.starPlayer.name,
      status:         'ACTIVE' as const,
      playerTypeName: 'Star Player',
      ma:             m.starPlayer.ma,
      st:             m.starPlayer.st,
      ag:             m.starPlayer.ag,
      av:             m.starPlayer.av,
      ssp:            0,
      skills:         m.starPlayer.skills.map((s) => ({ name: s.name, rule: s.skillRule })),
      isMerc:         true  as const,
      isStarPlayer:   true  as const,
      starPlayerId:   m.starPlayerId,
      mercCost:       m.price,
    }))

  const mapStarPlayers = (rows: typeof homeStarPlayerRows) =>
    rows.map((sp) => ({
      id:         sp.id,
      name:       sp.name,
      price:      sp.price!,
      ma:         sp.ma,
      st:         sp.st,
      ag:         sp.ag,
      av:         sp.av,
      skills:     sp.skills.map((s) => ({ name: s.name, rule: s.skillRule })),
      companions: sp.companions.map((c) => ({ id: c.id, name: c.name })),
    }))

  const lonerEntry = {
    name: 'Loner',
    rule: lonerSkill?.skillRule ?? 'Must roll 4+ on a D6 before using a team re-roll. On a failure the re-roll is lost.',
  }

  function withLoner(skills: { name: string; rule: string }[]) {
    return skills.some((s) => s.name === 'Loner') ? skills : [lonerEntry, ...skills]
  }

  // Synthesise merc MatchPlayer objects (use MatchMerc id as player id)
  const homeMercPlayers = matchMercs
    .filter((m) => m.side === 'home')
    .map((m) => ({
      id:             m.id,
      number:         0,
      name:           `Merc ${m.playerType.name}`,
      status:         'ACTIVE' as const,
      playerTypeName: m.playerType.name,
      ma:             m.playerType.ma,
      st:             m.playerType.st,
      ag:             m.playerType.ag,
      av:             m.playerType.av,
      ssp:            0,
      skills:         withLoner(m.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule }))),
      isMerc:         true,
      mercCost:       m.cost,
    }))

  const awayMercPlayers = matchMercs
    .filter((m) => m.side === 'away')
    .map((m) => ({
      id:             m.id,
      number:         0,
      name:           `Merc ${m.playerType.name}`,
      status:         'ACTIVE' as const,
      playerTypeName: m.playerType.name,
      ma:             m.playerType.ma,
      st:             m.playerType.st,
      ag:             m.playerType.ag,
      av:             m.playerType.av,
      ssp:            0,
      skills:         withLoner(m.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule }))),
      isMerc:         true,
      mercCost:       m.cost,
    }))

  const mapPriceList = (pts: typeof homePlayerTypes) =>
    pts.map((pt) => {
      const skills = pt.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule }))
      return {
        id:       pt.id,
        name:     pt.name,
        cost:     pt.cost,
        mercCost: pt.cost + 50000,
        ma:       pt.ma,
        st:       pt.st,
        ag:       pt.ag,
        av:       pt.av,
        skills:   withLoner(skills),
      }
    })

  const wizardDone = match.homeTeamValue !== null

  const matchData = {
    id:                match.id,
    status:            match.status as 'SCHEDULED' | 'LIVE',
    round:             match.round,
    wizardDone,
    homeTeamValue:     computeTV(match.homeTeam),
    awayTeamValue:     computeTV(match.awayTeam),
    homeTeamTreasury:  match.homeTeam.treasury,
    awayTeamTreasury:  match.awayTeam.treasury,
    homeTeamFanFactor: match.homeTeam.fanFactor,
    awayTeamFanFactor: match.awayTeam.fanFactor,
    homePlayerTypes:   mapPriceList(homePlayerTypes),
    awayPlayerTypes:   mapPriceList(awayPlayerTypes),
    homeStarPlayers:   mapStarPlayers(homeStarPlayerRows),
    awayStarPlayers:   mapStarPlayers(awayStarPlayerRows),
    homeTeam: {
      id:       match.homeTeam.id,
      name:     match.homeTeam.name,
      coachId:  match.homeTeam.coachId,
      raceName: match.homeTeam.race.name,
      players: [
        ...match.homeTeam.players.map((p) => ({
          id:             p.id,
          number:         p.number,
          name:           p.name,
          status:         p.status as 'ACTIVE' | 'MNG',
          playerTypeName: p.playerType.name,
          ma:             p.playerType.ma,
          st:             p.playerType.st,
          ag:             p.playerType.ag,
          av:             p.playerType.av,
          ssp:            p.ssp,
          skills:         p.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule })),
          isMerc:         false as const,
        })),
        ...homeMercPlayers,
        ...homeStarLinePlayers,
      ],
    },
    awayTeam: {
      id:       match.awayTeam.id,
      name:     match.awayTeam.name,
      coachId:  match.awayTeam.coachId,
      raceName: match.awayTeam.race.name,
      players: [
        ...match.awayTeam.players.map((p) => ({
          id:             p.id,
          number:         p.number,
          name:           p.name,
          status:         p.status as 'ACTIVE' | 'MNG',
          playerTypeName: p.playerType.name,
          ma:             p.playerType.ma,
          st:             p.playerType.st,
          ag:             p.playerType.ag,
          av:             p.playerType.av,
          ssp:            p.ssp,
          skills:         p.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule })),
          isMerc:         false as const,
        })),
        ...awayMercPlayers,
        ...awayStarLinePlayers,
      ],
    },
  }

  return <GameOnClient matchData={matchData} />
}
