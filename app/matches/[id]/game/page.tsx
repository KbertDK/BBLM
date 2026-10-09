import { redirect } from 'next/navigation'
import Link from 'next/link'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { skillRollsAvailable } from '@/lib/ssp'
import { computeTV } from '@/lib/teamValue'
import GameOnClient from './GameOnClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function GameOnPage({ params }: PageProps) {
  const { id } = await params
  const session = await getSession()

  const [match, lonerSkill] = await Promise.all([
    prisma.match.findUnique({
      where: { id },
      include: {
        weather: { select: { name: true, description: true } },
        league: { select: { ruleSet: { select: { spirallingExpenseTiers: {
          select: { teamValueThreshold: true, expenseAmount: true },
        } } } } },
        homeTeam: {
          select: {
            id:               true,
            name:             true,
            coachId:          true,
            raceId:           true,
            logoUrl:          true,
            treasury:         true,
            fanFactor:        true,
            rerolls:          true,
            assistantCoaches: true,
            cheerleaders:     true,
            apothecary:       true,
            race:             { select: { name: true, rerollPrice: true, hasApothecary: true } },
            players: {
              where:   { status: { in: ['ACTIVE', 'MNG'] } },
              select:  { id: true, number: true, name: true, status: true, ssp: true, value: true, maIncrease: true, stIncrease: true, agIncrease: true, avIncrease: true, playerType: { select: { name: true, cost: true, ma: true, st: true, ag: true, av: true, startingSkills: { select: { name: true, skillRule: true } } } } },
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
            logoUrl:          true,
            treasury:         true,
            fanFactor:        true,
            rerolls:          true,
            assistantCoaches: true,
            cheerleaders:     true,
            apothecary:       true,
            race:             { select: { name: true, rerollPrice: true, hasApothecary: true } },
            players: {
              where:   { status: { in: ['ACTIVE', 'MNG'] } },
              select:  { id: true, number: true, name: true, status: true, ssp: true, value: true, maIncrease: true, stIncrease: true, agIncrease: true, avIncrease: true, playerType: { select: { name: true, cost: true, ma: true, st: true, ag: true, av: true, startingSkills: { select: { name: true, skillRule: true } } } } },
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

  // Block launching a new match while either team has an un-resolved skill-up — either a
  // SkillRoll made but not yet consumed by picking a skill/stat, OR a player who has crossed
  // an SPP threshold but hasn't even rolled yet (no SkillRoll row exists for them at all).
  if (match.status === 'SCHEDULED') {
    const rosterPlayers = await prisma.teamPlayer.findMany({
      where: {
        teamId: { in: [match.homeTeamId, match.awayTeamId] },
        status: { in: ['ACTIVE', 'MNG'] },
      },
      select: {
        id: true, number: true, name: true, teamId: true, ssp: true,
        playerType: { select: { name: true } },
        _count:     { select: { skillRolls: true } },
        skillRolls: { where: { consumed: false }, select: { id: true } },
      },
    })

    const pendingPlayers = rosterPlayers.filter((p) =>
      p.skillRolls.length > 0 || skillRollsAvailable(p.ssp, p._count.skillRolls) > 0
    )

    if (pendingPlayers.length > 0) {
      const teamNameById: Record<string, string> = {
        [match.homeTeamId]: match.homeTeam.name,
        [match.awayTeamId]: match.awayTeam.name,
      }
      return (
        <div className="min-h-screen bg-bb-darker flex items-center justify-center text-white p-4">
          <div className="text-center p-8 border border-bb-gold/30 rounded-sm bg-bb-dark max-w-md w-full">
            <div className="text-4xl mb-4">🎲</div>
            <h1 className="font-heading text-xl font-black text-bb-gold mb-3">Unresolved Skill-Ups</h1>
            <p className="text-bb-muted text-sm mb-5">
              The following players have a skill-up roll that hasn&apos;t been resolved yet.
              Pick their skill or characteristic increase on the Team Roster page before starting this match.
            </p>
            <div className="space-y-2 text-left">
              {pendingPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-3 bg-bb-darker border border-bb-border rounded-sm px-3 py-2">
                  <div>
                    <p className="text-sm text-white">#{p.number} {p.name ?? p.playerType.name}</p>
                    <p className="text-xs text-bb-muted">{teamNameById[p.teamId]}</p>
                  </div>
                  <Link href={`/teams/${p.teamId}`}
                    className="shrink-0 px-3 py-1.5 rounded-sm border border-bb-gold/50 text-bb-gold text-xs font-heading uppercase tracking-wider hover:bg-bb-gold hover:text-bb-dark transition-colors">
                    Resolve →
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>
      )
    }
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

  // Parallel-fetch pricelist player types, mercs, journeymen, star players, generic inducements, and Special Play Card decks
  const [homePlayerTypes, awayPlayerTypes, matchMercs, matchJourneymen, homeStarPlayerRows, awayStarPlayerRows, matchStarRows, mdInducements, matchInducements, specialPlayDecks, matchSpecialPlayCards, kickoffTableRows] = await Promise.all([
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
    prisma.matchJourneyman.findMany({
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
    prisma.mdInducement.findMany({ orderBy: { price: 'asc' } }),
    prisma.matchInducement.findMany({
      where:   { matchId: id },
      include: { inducement: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.mdSpecialPlayDeck.findMany({
      orderBy: { price: 'asc' },
      include: { cards: { orderBy: { cardLabel: 'asc' } } },
    }),
    prisma.matchSpecialPlayCard.findMany({
      where:   { matchId: id },
      include: { deck: true, card: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.mdMatchEvent.findMany({
      where:   { eventType: 'Kick off' },
      select:  { dieRoll: true, name: true, description: true },
      orderBy: { dieRoll: 'asc' },
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

  // Synthesise journeyman MatchPlayer objects. RAW (CRP1): journeymen have the Loner skill
  // while serving — they lose it only once permanently signed to the roster.
  const homeJourneymanPlayers = matchJourneymen
    .filter((m) => m.side === 'home')
    .map((m) => ({
      id:             m.id,
      number:         m.number ?? 0,
      name:           `Journeyman ${m.playerType.name}`,
      status:         'ACTIVE' as const,
      playerTypeName: m.playerType.name,
      ma:             m.playerType.ma,
      st:             m.playerType.st,
      ag:             m.playerType.ag,
      av:             m.playerType.av,
      ssp:            0,
      skills:         withLoner(m.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule }))),
      isMerc:         false,
      isJourneyman:   true,
    }))

  const awayJourneymanPlayers = matchJourneymen
    .filter((m) => m.side === 'away')
    .map((m) => ({
      id:             m.id,
      number:         m.number ?? 0,
      name:           `Journeyman ${m.playerType.name}`,
      status:         'ACTIVE' as const,
      playerTypeName: m.playerType.name,
      ma:             m.playerType.ma,
      st:             m.playerType.st,
      ag:             m.playerType.ag,
      av:             m.playerType.av,
      ssp:            0,
      skills:         withLoner(m.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule }))),
      isMerc:         false,
      isJourneyman:   true,
    }))

  const homeJourneymenValue = matchJourneymen.filter((m) => m.side === 'home').reduce((s, m) => s + m.playerType.cost, 0)
  const awayJourneymenValue = matchJourneymen.filter((m) => m.side === 'away').reduce((s, m) => s + m.playerType.cost, 0)

  // Mercs/star players count toward Team Value at their base cost (not the +50k mercenary hiring premium)
  const homeMercsValue = matchMercs.filter((m) => m.side === 'home').reduce((s, m) => s + m.playerType.cost, 0)
  const awayMercsValue = matchMercs.filter((m) => m.side === 'away').reduce((s, m) => s + m.playerType.cost, 0)
  const homeStarsValue = matchStarRows.filter((m) => m.side === 'home').reduce((s, m) => s + m.price, 0)
  const awayStarsValue = matchStarRows.filter((m) => m.side === 'away').reduce((s, m) => s + m.price, 0)

  const homeInducementValue = homeJourneymenValue + homeMercsValue + homeStarsValue
  const awayInducementValue = awayJourneymenValue + awayMercsValue + awayStarsValue

  // Eligible journeyman positions: the race's basic "filler" position(s), identified by maxCount >= 10
  const mapJourneymanTypes = (pts: typeof homePlayerTypes) =>
    pts
      .filter((pt) => pt.maxCount >= 10)
      .map((pt) => ({
        id:     pt.id,
        name:   pt.name,
        cost:   pt.cost,
        ma:     pt.ma,
        st:     pt.st,
        ag:     pt.ag,
        av:     pt.av,
        skills: pt.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule })),
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

  // Generic (non-player) inducements: Bribes/Chef get a race-specific discount, Igor requires no apothecary access
  function priceInducements(raceName: string, hasApothecary: boolean) {
    return mdInducements
      .filter((ind) => ind.name !== 'Igor' || !hasApothecary)
      .map((ind) => {
        let price = ind.price
        if (ind.name === 'Bribes' && raceName === 'Goblin') price = 50000
        if (ind.name === 'Halfling Master Chef' && raceName === 'Halfling') price = 100000
        return { id: ind.id, name: ind.name, maxCount: ind.maxCount, price, rule: ind.rule }
      })
  }

  const homeInducementsPurchased = matchInducements
    .filter((m) => m.side === 'home')
    .map((m) => ({ id: m.id, inducementId: m.inducementId, name: m.inducement.name, cost: m.cost, rule: m.inducement.rule, used: m.used, chefHalf1Used: m.chefHalf1Used, chefHalf2Used: m.chefHalf2Used }))
  const awayInducementsPurchased = matchInducements
    .filter((m) => m.side === 'away')
    .map((m) => ({ id: m.id, inducementId: m.inducementId, name: m.inducement.name, cost: m.cost, rule: m.inducement.rule, used: m.used, chefHalf1Used: m.chefHalf1Used, chefHalf2Used: m.chefHalf2Used }))

  const specialPlayDeckList = specialPlayDecks.map((d) => ({
    id:    d.id,
    name:  d.name,
    price: d.price,
    cards: d.cards.map((c) => ({ id: c.id, cardLabel: c.cardLabel, name: c.name, description: c.description, timing: c.timing, effect: c.effect })),
  }))
  const mapSpecialPlayCards = (side: 'home' | 'away') => matchSpecialPlayCards
    .filter((m) => m.side === side)
    .map((m) => ({
      id:        m.id,
      deckId:    m.deckId,
      deckName:  m.deck.name,
      cost:      m.cost,
      cardId:    m.cardId,
      cardName:  m.card?.name ?? null,
      turn:      m.turn,
    }))
  const homeSpecialPlayCards = mapSpecialPlayCards('home')
  const awaySpecialPlayCards = mapSpecialPlayCards('away')

  const wizardDone = match.homeTeamValue !== null

  const matchData = {
    id:                match.id,
    status:            match.status as 'SCHEDULED' | 'LIVE',
    round:             match.round,
    wizardDone,
    homeTeamValue:     computeTV(match.homeTeam, homeInducementValue),
    awayTeamValue:     computeTV(match.awayTeam, awayInducementValue),
    // Frozen roster-only value (excludes this match's journeymen/mercs/stars) — the correct
    // basis for the Inducement gold gap, which must not shrink as that gold gets spent.
    homeBaseTeamValue: computeTV(match.homeTeam),
    awayBaseTeamValue: computeTV(match.awayTeam),
    homeTeamTreasury:  match.homeTeam.treasury,
    awayTeamTreasury:  match.awayTeam.treasury,
    homeTeamFanFactor: match.homeTeam.fanFactor,
    awayTeamFanFactor: match.awayTeam.fanFactor,
    homeCheerleaders:     match.homeTeam.cheerleaders,
    awayCheerleaders:     match.awayTeam.cheerleaders,
    homeAssistantCoaches: match.homeTeam.assistantCoaches,
    awayAssistantCoaches: match.awayTeam.assistantCoaches,
    homePlayerTypes:   mapPriceList(homePlayerTypes),
    awayPlayerTypes:   mapPriceList(awayPlayerTypes),
    homeJourneymanTypes: mapJourneymanTypes(homePlayerTypes),
    awayJourneymanTypes: mapJourneymanTypes(awayPlayerTypes),
    homeStarPlayers:   mapStarPlayers(homeStarPlayerRows),
    awayStarPlayers:   mapStarPlayers(awayStarPlayerRows),
    homeInducementTypes: priceInducements(homeRaceName, match.homeTeam.race.hasApothecary),
    awayInducementTypes: priceInducements(awayRaceName, match.awayTeam.race.hasApothecary),
    homeInducementsPurchased,
    awayInducementsPurchased,
    homeHasApothecary:    match.homeTeam.race.hasApothecary,
    awayHasApothecary:    match.awayTeam.race.hasApothecary,
    homeApothecaryUsed:   match.homeApothecaryUsed,
    awayApothecaryUsed:   match.awayApothecaryUsed,
    weather:        match.weather ? { name: match.weather.name, description: match.weather.description ?? '' } : null,
    homePettyCash:  match.homePettyCash,
    awayPettyCash:  match.awayPettyCash,
    homeFans:       match.homeFans,
    awayFans:       match.awayFans,
    homeFame:       match.homeFame,
    awayFame:       match.awayFame,
    spirallingExpenseTiers: match.league?.ruleSet?.spirallingExpenseTiers ?? [],
    specialPlayDecks:    specialPlayDeckList,
    homeSpecialPlayCards,
    awaySpecialPlayCards,
    kickoffTable: kickoffTableRows.map((r) => ({ dieRoll: r.dieRoll!, name: r.name, description: r.description ?? '' })),
    homeTeam: {
      id:       match.homeTeam.id,
      name:     match.homeTeam.name,
      coachId:  match.homeTeam.coachId,
      raceName: match.homeTeam.race.name,
      logoUrl:  match.homeTeam.logoUrl ?? null,
      players: [
        ...match.homeTeam.players.map((p) => ({
          id:             p.id,
          number:         p.number,
          name:           p.name,
          status:         p.status as 'ACTIVE' | 'MNG',
          playerTypeName: p.playerType.name,
          ma:             p.playerType.ma + p.maIncrease,
          st:             p.playerType.st + p.stIncrease,
          ag:             p.playerType.ag + p.agIncrease,
          av:             p.playerType.av + p.avIncrease,
          ssp:            p.ssp,
          skills:         p.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule })),
          isMerc:         false as const,
        })),
        ...homeMercPlayers,
        ...homeStarLinePlayers,
        ...homeJourneymanPlayers,
      ],
    },
    awayTeam: {
      id:       match.awayTeam.id,
      name:     match.awayTeam.name,
      coachId:  match.awayTeam.coachId,
      raceName: match.awayTeam.race.name,
      logoUrl:  match.awayTeam.logoUrl ?? null,
      players: [
        ...match.awayTeam.players.map((p) => ({
          id:             p.id,
          number:         p.number,
          name:           p.name,
          status:         p.status as 'ACTIVE' | 'MNG',
          playerTypeName: p.playerType.name,
          ma:             p.playerType.ma + p.maIncrease,
          st:             p.playerType.st + p.stIncrease,
          ag:             p.playerType.ag + p.agIncrease,
          av:             p.playerType.av + p.avIncrease,
          ssp:            p.ssp,
          skills:         p.playerType.startingSkills.map((s) => ({ name: s.name, rule: s.skillRule })),
          isMerc:         false as const,
        })),
        ...awayMercPlayers,
        ...awayStarLinePlayers,
        ...awayJourneymanPlayers,
      ],
    },
  }

  return <GameOnClient matchData={matchData} />
}
