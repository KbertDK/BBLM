'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getSession } from '@/lib/auth'
import { spirallingExpenseFor } from '@/lib/spirallingExpenses'
import { computePettyCashReturn } from '@/lib/postMatchFinance'
import { computeTV } from '@/lib/teamValue'
import { generateMatchRecap } from '@/lib/recap'

async function requireMatchParticipant(matchId: string) {
  const session = await getSession()
  if (!session) return null

  const match = await prisma.match.findUnique({
    where:  { id: matchId },
    select: {
      homeTeam: { select: { coachId: true } },
      awayTeam: { select: { coachId: true } },
    },
  })
  if (!match) return null

  const ok =
    session.coachId === match.homeTeam.coachId ||
    session.coachId === match.awayTeam.coachId ||
    session.role === 'COMMISH' ||
    session.role === 'ADMIN'

  return ok ? session : null
}

// Maps short game event codes to MdMatchEvent names for FK lookup
const MD_EVENT_NAME: Record<string, string> = {
  TD:            'Touch Down',
  INTERCEPTION:  'Interception',
  CASUALTY:      'Block',  // default cause; specific cause can be set manually via Data Manager
}

async function resolveMdMatchEventId(type: string): Promise<string | null> {
  const name = MD_EVENT_NAME[type]
  if (!name) return null
  const found = await prisma.mdMatchEvent.findFirst({ where: { name }, select: { id: true } })
  return found?.id ?? null
}

export async function pushMatchEvent(matchId: string, type: string, label: string, scoringTeam?: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const mdMatchEventId = await resolveMdMatchEventId(type)
  await prisma.matchEvent.create({ data: { matchId, type, label, scoringTeam: scoringTeam ?? null, mdMatchEventId } })
  revalidatePath('/')
}

export async function deleteLastMatchEvent(matchId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const last = await prisma.matchEvent.findFirst({
    where:   { matchId },
    orderBy: { createdAt: 'desc' },
    select:  { id: true },
  })
  if (!last) return
  await prisma.matchEvent.delete({ where: { id: last.id } })
  revalidatePath('/')
}

export async function savePrematchData(matchId: string, data: {
  homeTeamValue:     number
  awayTeamValue:     number
  homeTeamFanFactor: number
  awayTeamFanFactor: number
}) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.match.update({ where: { id: matchId }, data })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function rollWeather(matchId: string, die1: number, die2: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  if (die1 < 1 || die1 > 6 || die2 < 1 || die2 > 6) return

  const result = await prisma.mdMatchEvent.findFirst({
    where:  { eventType: 'Weather', dieRoll: die1 + die2 },
    select: { id: true, name: true, description: true },
  })
  if (!result) return

  // Record immediately as a real MatchEvent row (not just a Match.weatherMdMatchEventId pointer),
  // so the roll is durably logged even if the match is later abandoned before completion.
  await prisma.$transaction([
    prisma.match.update({ where: { id: matchId }, data: { weatherMdMatchEventId: result.id } }),
    prisma.matchEvent.create({
      data: {
        matchId,
        type:  'WEATHER',
        label: `🌦️ Weather — ${result.name}: ${result.description ?? ''}`,
        mdMatchEventId: result.id,
      },
    }),
  ])
  revalidatePath(`/matches/${matchId}/game`)
}

// The caller (client) has already looked up the result row (via matchData.kickoffTable) to
// build the rich `label` — all the roll-comparison/affected-player detail lives in that label,
// same convention as every other event type. This just re-resolves the row server-side for the
// mdMatchEventId FK and persists the event.
export async function rollKickoff(matchId: string, dieRoll: number, label: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  if (dieRoll < 2 || dieRoll > 12) return

  const result = await prisma.mdMatchEvent.findFirst({
    where:  { eventType: 'Kick off', dieRoll },
    select: { id: true },
  })
  if (!result) return

  await prisma.matchEvent.create({
    data: { matchId, type: 'KICKOFF', label, mdMatchEventId: result.id },
  })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function commitPettyCash(matchId: string, homePettyGold: number, awayPettyGold: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  if (homePettyGold < 0 || awayPettyGold < 0) return

  const match = await prisma.match.findUnique({
    where:  { id: matchId },
    select: { homePettyCash: true, awayPettyCash: true, homeTeamId: true, awayTeamId: true },
  })
  if (!match) return

  const [homeTeam, awayTeam] = await Promise.all([
    prisma.team.findUnique({ where: { id: match.homeTeamId }, select: { treasury: true } }),
    prisma.team.findUnique({ where: { id: match.awayTeamId }, select: { treasury: true } }),
  ])
  if (!homeTeam || !awayTeam) return

  const homeDelta = homePettyGold - match.homePettyCash
  const awayDelta = awayPettyGold - match.awayPettyCash
  if (homeTeam.treasury - homeDelta < 0 || awayTeam.treasury - awayDelta < 0) return

  await prisma.$transaction([
    prisma.team.update({ where: { id: match.homeTeamId }, data: { treasury: { decrement: homeDelta } } }),
    prisma.team.update({ where: { id: match.awayTeamId }, data: { treasury: { decrement: awayDelta } } }),
    prisma.match.update({ where: { id: matchId }, data: { homePettyCash: homePettyGold, awayPettyCash: awayPettyGold } }),
  ])
  revalidatePath(`/matches/${matchId}/game`)
}

export async function saveFansAndFame(
  matchId: string,
  homeDie1: number, homeDie2: number,
  awayDie1: number, awayDie2: number,
) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  if ([homeDie1, homeDie2, awayDie1, awayDie2].some((d) => d < 1 || d > 6)) return

  const match = await prisma.match.findUnique({
    where:  { id: matchId },
    select: { homeTeam: { select: { fanFactor: true } }, awayTeam: { select: { fanFactor: true } } },
  })
  if (!match) return

  const homeFans = (homeDie1 + homeDie2 + match.homeTeam.fanFactor) * 1000
  const awayFans = (awayDie1 + awayDie2 + match.awayTeam.fanFactor) * 1000
  const homeFame = homeFans <= awayFans ? 0 : homeFans >= awayFans * 2 ? 2 : 1
  const awayFame = awayFans <= homeFans ? 0 : awayFans >= homeFans * 2 ? 2 : 1

  await prisma.match.update({ where: { id: matchId }, data: { homeFans, awayFans, homeFame, awayFame } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireMerc(matchId: string, side: 'home' | 'away', playerTypeId: string, cost: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchMerc.create({ data: { matchId, side, playerTypeId, cost } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeMerc(matchId: string, mercId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchMerc.deleteMany({ where: { id: mercId, matchId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireStarPlayer(matchId: string, side: 'home' | 'away', starPlayerId: string, price: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const exists = await prisma.matchStarPlayer.findFirst({ where: { matchId, side, starPlayerId } })
  if (exists) return
  await prisma.matchStarPlayer.create({ data: { matchId, side, starPlayerId, price } })
  // Auto-hire companions (Grotty with Brick, Dribl with Drull, Valen with Lucian)
  const sp = await prisma.mdStarPlayer.findUnique({
    where: { id: starPlayerId },
    select: { companions: { select: { id: true } } },
  })
  if (sp?.companions.length) {
    await prisma.matchStarPlayer.createMany({
      data: sp.companions.map((c) => ({ matchId, side, starPlayerId: c.id, price: 0, isCompanion: true })),
      skipDuplicates: true,
    })
  }
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeStarPlayer(matchId: string, id: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const record = await prisma.matchStarPlayer.findUnique({ where: { id } })
  if (!record || record.isCompanion) return
  const sp = await prisma.mdStarPlayer.findUnique({
    where: { id: record.starPlayerId },
    select: { companions: { select: { id: true } } },
  })
  if (sp?.companions.length) {
    await prisma.matchStarPlayer.deleteMany({
      where: { matchId, side: record.side, starPlayerId: { in: sp.companions.map((c) => c.id) } },
    })
  }
  await prisma.matchStarPlayer.delete({ where: { id } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireJourneyman(matchId: string, side: 'home' | 'away', playerTypeId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchJourneyman.create({ data: { matchId, side, playerTypeId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeJourneyman(matchId: string, id: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchJourneyman.deleteMany({ where: { id, matchId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function updateJourneymanNumber(matchId: string, journeymanId: string, number: number | null) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  if (number !== null && (number < 1 || number > 99)) return
  await prisma.matchJourneyman.updateMany({ where: { id: journeymanId, matchId }, data: { number } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function hireInducement(matchId: string, side: 'home' | 'away', inducementId: string, cost: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const inducement = await prisma.mdInducement.findUnique({ where: { id: inducementId } })
  if (!inducement) return
  const count = await prisma.matchInducement.count({ where: { matchId, side, inducementId } })
  if (count >= inducement.maxCount) return
  await prisma.matchInducement.create({ data: { matchId, side, inducementId, cost } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeInducement(matchId: string, id: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.matchInducement.deleteMany({ where: { id, matchId } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function buySpecialPlayCard(matchId: string, side: 'home' | 'away', deckId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const deck = await prisma.mdSpecialPlayDeck.findUnique({ where: { id: deckId } })
  if (!deck) return
  await prisma.matchSpecialPlayCard.create({ data: { matchId, side, deckId, cost: deck.price } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function removeSpecialPlayCard(matchId: string, id: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  // Only an un-revealed draw may be cancelled — one already played live is locked in.
  await prisma.matchSpecialPlayCard.deleteMany({ where: { id, matchId, cardId: null } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function registerSpecialPlayCard(matchId: string, slotId: string, cardId: string, turn: number) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  if (turn < 1 || turn > 16) return
  const slot = await prisma.matchSpecialPlayCard.findUnique({
    where:  { id: slotId },
    select: { matchId: true, deckId: true, cardId: true },
  })
  if (!slot || slot.matchId !== matchId || slot.cardId) return
  const card = await prisma.mdSpecialPlayCard.findUnique({ where: { id: cardId }, select: { deckId: true } })
  if (!card || card.deckId !== slot.deckId) return
  await prisma.matchSpecialPlayCard.update({ where: { id: slotId }, data: { cardId, turn } })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function markInducementUsed(matchId: string, id: string, half?: 1 | 2) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  const data = half === 1 ? { chefHalf1Used: true } : half === 2 ? { chefHalf2Used: true } : { used: true }
  await prisma.matchInducement.updateMany({ where: { id, matchId }, data })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function markApothecaryUsed(matchId: string, side: 'home' | 'away') {
  const session = await requireMatchParticipant(matchId)
  if (!session) return
  await prisma.match.updateMany({
    where: { id: matchId },
    data: side === 'home' ? { homeApothecaryUsed: true } : { awayApothecaryUsed: true },
  })
  revalidatePath(`/matches/${matchId}/game`)
}

export async function startMatch(matchId: string) {
  const session = await requireMatchParticipant(matchId)
  if (!session) return

  await prisma.match.updateMany({
    where: { id: matchId, status: 'SCHEDULED' },
    data:  { status: 'LIVE' },
  })

  revalidatePath('/')
  revalidatePath('/league-management')
}

interface PlayerUpdate {
  playerId:              string
  deltaTouchdowns:       number
  deltaCompletePasses:   number
  deltaInterceptions:    number
  deltaCasualties:       number
  deltaSSP:              number
  deltaMVP:              number
  deltaNigglingInjuries: number
  newStatus:             'ACTIVE' | 'MNG' | 'DEAD' | null
  isDeathPost:           boolean
}

interface JourneymanUpdate {
  id: string
  deltaTouchdowns: number
  deltaCompletePasses: number
  deltaInterceptions: number
  deltaCasualties: number
  deltaMVP: number
  deltaSSP: number
  injuryStatus: 'ACTIVE' | 'MNG' | 'DEAD'
}

interface MercStarUpdate {
  id: string
  deltaMVP: number
}

interface RosterStatRow {
  playerId: string
  touchdowns: number
  completePasses: number
  interceptions: number
  casualties: number
  mvp: number
  ssp: number
}

interface EventRecord {
  type:  string
  label: string
}

interface CompletePayload {
  matchId: string
  homeScore: number
  awayScore: number
  homeWinnings: number
  awayWinnings: number
  playerUpdates: PlayerUpdate[]
  journeymanUpdates: JourneymanUpdate[]
  mercUpdates: MercStarUpdate[]
  starUpdates: MercStarUpdate[]
  rosterStatRows: RosterStatRow[]
  events: EventRecord[]
}

export async function completeMatchFull(formData: FormData) {
  const raw = formData.get('payload') as string | null
  if (!raw) return

  let payload: CompletePayload
  try { payload = JSON.parse(raw) } catch { return }

  const {
    matchId, homeScore, awayScore, homeWinnings, awayWinnings, events = [],
    playerUpdates = [], journeymanUpdates = [], mercUpdates = [], starUpdates = [], rosterStatRows = [],
  } = payload

  const session = await requireMatchParticipant(matchId)
  if (!session) return

  const match = await prisma.match.findUnique({
    where:  { id: matchId },
    select: {
      status:         true,
      homeTeamId:     true,
      awayTeamId:     true,
      homeTeamValue:  true,
      awayTeamValue:  true,
      homePettyCash:  true,
      awayPettyCash:  true,
      homeTeam: {
        select: {
          name: true, rerolls: true, assistantCoaches: true, cheerleaders: true, fanFactor: true, apothecary: true,
          race:    { select: { rerollPrice: true } },
          players: { where: { status: 'ACTIVE' }, select: { status: true, value: true, playerType: { select: { cost: true } } } },
        },
      },
      awayTeam: {
        select: {
          name: true, rerolls: true, assistantCoaches: true, cheerleaders: true, fanFactor: true, apothecary: true,
          race:    { select: { rerollPrice: true } },
          players: { where: { status: 'ACTIVE' }, select: { status: true, value: true, playerType: { select: { cost: true } } } },
        },
      },
      league: { select: { ruleSet: { select: { spirallingExpenseTiers: {
        select: { teamValueThreshold: true, expenseAmount: true },
      } } } } },
    },
  })
  if (!match || match.status === 'COMPLETED') return

  const homeWin = homeScore > awayScore
  const awayWin = awayScore > homeScore
  const isDraw  = homeScore === awayScore

  // Petty Cash accounting (CRP1): only UNSPENT Petty Cash returns to treasury — inducement
  // gold from the Team Value gap is "use it or lose it" and never returns either way.
  const [
    homeMercAgg, homeStarAgg, homeIndAgg, homeCardAgg,
    awayMercAgg, awayStarAgg, awayIndAgg, awayCardAgg,
  ] = await Promise.all([
    prisma.matchMerc.aggregate({ where: { matchId, side: 'home' }, _sum: { cost: true } }),
    prisma.matchStarPlayer.aggregate({ where: { matchId, side: 'home', isCompanion: false }, _sum: { price: true } }),
    prisma.matchInducement.aggregate({ where: { matchId, side: 'home' }, _sum: { cost: true } }),
    prisma.matchSpecialPlayCard.aggregate({ where: { matchId, side: 'home' }, _sum: { cost: true } }),
    prisma.matchMerc.aggregate({ where: { matchId, side: 'away' }, _sum: { cost: true } }),
    prisma.matchStarPlayer.aggregate({ where: { matchId, side: 'away', isCompanion: false }, _sum: { price: true } }),
    prisma.matchInducement.aggregate({ where: { matchId, side: 'away' }, _sum: { cost: true } }),
    prisma.matchSpecialPlayCard.aggregate({ where: { matchId, side: 'away' }, _sum: { cost: true } }),
  ])
  const homeSpent = (homeMercAgg._sum.cost ?? 0) + (homeStarAgg._sum.price ?? 0) + (homeIndAgg._sum.cost ?? 0) + (homeCardAgg._sum.cost ?? 0)
  const awaySpent = (awayMercAgg._sum.cost ?? 0) + (awayStarAgg._sum.price ?? 0) + (awayIndAgg._sum.cost ?? 0) + (awayCardAgg._sum.cost ?? 0)

  // Struck from the frozen roster-only value (not match.homeTeamValue/awayTeamValue, which
  // include this match's journeymen/mercs/stars) — matches the gap basis used when the
  // Inducement gold budget was originally offered, so the split vs. Petty Cash is accurate.
  const { homePettyCashReturned, awayPettyCashReturned } = computePettyCashReturn({
    homeTeamValue: computeTV(match.homeTeam),
    awayTeamValue: computeTV(match.awayTeam),
    homePettyCash: match.homePettyCash,
    awayPettyCash: match.awayPettyCash,
    homeSpent,
    awaySpent,
  })

  // Spiralling Expenses (CRP1): deducted after winnings/Petty Cash return, never below zero.
  const tiers = match.league.ruleSet?.spirallingExpenseTiers ?? []
  const homeExpense = spirallingExpenseFor(match.homeTeamValue ?? 0, tiers)
  const awayExpense = spirallingExpenseFor(match.awayTeamValue ?? 0, tiers)
  const [homeTeamRow, awayTeamRow] = await Promise.all([
    prisma.team.findUnique({ where: { id: match.homeTeamId }, select: { treasury: true } }),
    prisma.team.findUnique({ where: { id: match.awayTeamId }, select: { treasury: true } }),
  ])
  const homeAvailable = (homeTeamRow?.treasury ?? 0) + homeWinnings + homePettyCashReturned
  const awayAvailable = (awayTeamRow?.treasury ?? 0) + awayWinnings + awayPettyCashReturned
  const homeExpenseClamped = Math.min(homeExpense, Math.max(0, homeAvailable))
  const awayExpenseClamped = Math.min(awayExpense, Math.max(0, awayAvailable))

  const deathIds = playerUpdates.filter((u) => u.isDeathPost).map((u) => u.playerId)
  const deathPlayers = deathIds.length > 0
    ? await prisma.teamPlayer.findMany({
        where:  { id: { in: deathIds } },
        select: { id: true, name: true, teamId: true, playerType: { select: { name: true } } },
      })
    : []

  const playerMap  = new Map(deathPlayers.map((p) => [p.id, p]))
  const teamNames  = new Map<string, string>([
    [match.homeTeamId, match.homeTeam.name],
    [match.awayTeamId, match.awayTeam.name],
  ])

  // Players who were already MNG coming into this match have now served their one-match suspension —
  // clear it unless this match itself just reinjured them (the only MNG left should be from this match).
  const newMngIds = new Set(playerUpdates.filter((u) => u.newStatus === 'MNG').map((u) => u.playerId))
  const staleMngPlayers = await prisma.teamPlayer.findMany({
    where:  { teamId: { in: [match.homeTeamId, match.awayTeamId] }, status: 'MNG' },
    select: { id: true },
  })
  const staleMngIds = staleMngPlayers.map((p) => p.id).filter((id) => !newMngIds.has(id))

  // CRP1 post-match fan factor adjustment:
  // Winner rolls D6 — 4+ means +1 FF. Loser rolls D6 — 1-3 means -1 FF. Draw = no change.
  const homeFfRoll = Math.floor(Math.random() * 6) + 1
  const awayFfRoll = Math.floor(Math.random() * 6) + 1
  const homeFfDelta = homeWin ? (homeFfRoll >= 4 ? 1 : 0)
                   : awayWin  ? (homeFfRoll <= 3 ? -1 : 0)
                   : 0
  const awayFfDelta = awayWin ? (awayFfRoll >= 4 ? 1 : 0)
                   : homeWin  ? (awayFfRoll <= 3 ? -1 : 0)
                   : 0
  const homeFfNew = Math.max(0, Math.min(9, match.homeTeam.fanFactor + homeFfDelta))
  const awayFfNew = Math.max(0, Math.min(9, match.awayTeam.fanFactor + awayFfDelta))

  await prisma.$transaction([
    prisma.match.update({
      where: { id: matchId },
      data:  { status: 'COMPLETED', homeScore, awayScore },
    }),
    prisma.team.update({
      where: { id: match.homeTeamId },
      data: {
        wins:      { increment: homeWin ? 1 : 0 },
        losses:    { increment: awayWin ? 1 : 0 },
        draws:     { increment: isDraw  ? 1 : 0 },
        treasury:  { increment: homeWinnings + homePettyCashReturned - homeExpenseClamped },
        fanFactor: homeFfNew,
      },
    }),
    prisma.team.update({
      where: { id: match.awayTeamId },
      data: {
        wins:      { increment: awayWin ? 1 : 0 },
        losses:    { increment: homeWin ? 1 : 0 },
        draws:     { increment: isDraw  ? 1 : 0 },
        treasury:  { increment: awayWinnings + awayPettyCashReturned - awayExpenseClamped },
        fanFactor: awayFfNew,
      },
    }),
    ...playerUpdates.map((u) => {
      const data: Prisma.TeamPlayerUpdateInput = {
        touchdowns:     { increment: u.deltaTouchdowns },
        completePasses: { increment: u.deltaCompletePasses },
        interceptions:  { increment: u.deltaInterceptions },
        casualties:     { increment: u.deltaCasualties },
        ssp:            { increment: u.deltaSSP },
        mvp:            { increment: u.deltaMVP },
      }
      if (u.newStatus !== null) data.status = u.newStatus
      if (u.deltaNigglingInjuries > 0) data.nigglingInjuries = { increment: u.deltaNigglingInjuries }
      return prisma.teamPlayer.update({ where: { id: u.playerId }, data })
    }),
    ...(staleMngIds.length > 0
      ? [prisma.teamPlayer.updateMany({ where: { id: { in: staleMngIds } }, data: { status: 'ACTIVE' } })]
      : []),
    ...journeymanUpdates.map((u) => prisma.matchJourneyman.update({
      where: { id: u.id },
      data: {
        touchdowns:     { increment: u.deltaTouchdowns },
        completePasses: { increment: u.deltaCompletePasses },
        interceptions:  { increment: u.deltaInterceptions },
        casualties:     { increment: u.deltaCasualties },
        mvp:            { increment: u.deltaMVP },
        ssp:            { increment: u.deltaSSP },
        injuryStatus:   u.injuryStatus,
      },
    })),
    // RAW: Mercenaries/Star Players only ever earn the MVP award — never skill up.
    ...mercUpdates.filter((u) => u.deltaMVP > 0).map((u) => prisma.matchMerc.update({
      where: { id: u.id },
      data:  { mvp: { increment: u.deltaMVP } },
    })),
    ...starUpdates.filter((u) => u.deltaMVP > 0).map((u) => prisma.matchStarPlayer.update({
      where: { id: u.id },
      data:  { mvp: { increment: u.deltaMVP } },
    })),
    // Per-match stat snapshot (distinct from the cumulative totals above), for match report / player history display.
    ...rosterStatRows.map((r) => prisma.matchPlayerStat.create({
      data: {
        matchId,
        teamPlayerId:   r.playerId,
        touchdowns:     r.touchdowns,
        completePasses: r.completePasses,
        interceptions:  r.interceptions,
        casualties:     r.casualties,
        mvp:            r.mvp,
        ssp:            r.ssp,
      },
    })),
    ...deathIds.map((pid) => {
      const p = playerMap.get(pid)
      const playerName = p?.name?.trim() || 'An unnamed warrior'
      const teamName   = p ? (teamNames.get(p.teamId) ?? 'their team') : 'their team'
      const position   = p?.playerType.name ?? 'player'
      return prisma.newsPost.create({
        data: {
          title:    `${playerName} of ${teamName} has fallen!`,
          body:     `${playerName}, ${position} for ${teamName}, was slain on the Blood Bowl pitch. They will be remembered — and mourned — by those brave enough to take the field after them.`,
          authorId: session.coachId,
          teamId:   p?.teamId,
          playerId: pid,
        },
      })
    }),
  ])

  // Sync the authoritative event log from the client — wipe any partially-saved
  // events and replace with the complete ordered list from local state. WEATHER events are
  // excluded: `rollWeather` already wrote that row directly (durable from the moment it's
  // rolled, even if the match is later abandoned), and it has its own per-roll mdMatchEventId
  // resolution that doesn't fit the generic MD_EVENT_NAME-by-type lookup below.
  const syncableEvents = events.filter((e) => e.type !== 'WEATHER')
  if (syncableEvents.length > 0) {
    // Bulk-resolve MdMatchEvent IDs for known event types
    const uniqueTypes = [...new Set(syncableEvents.map((e) => e.type).filter((t) => t in MD_EVENT_NAME))]
    const mdRows = uniqueTypes.length
      ? await prisma.mdMatchEvent.findMany({
          where: { name: { in: uniqueTypes.map((t) => MD_EVENT_NAME[t]) } },
          select: { id: true, name: true },
        })
      : []
    const mdByName = new Map(mdRows.map((r: { id: string; name: string }) => [r.name, r.id]))
    const getMdId = (type: string) => {
      const name = MD_EVENT_NAME[type]
      return name ? (mdByName.get(name) ?? null) : null
    }

    const base = Date.now()
    await prisma.$transaction([
      prisma.matchEvent.deleteMany({ where: { matchId, type: { not: 'WEATHER' } } }),
      prisma.matchEvent.createMany({
        data: syncableEvents.map((e, i) => ({
          matchId,
          type:          e.type,
          label:         e.label,
          mdMatchEventId: getMdId(e.type),
          createdAt:     new Date(base + i),   // 1 ms apart preserves order; always after the WEATHER row's roll-time createdAt
        })),
      }),
    ])
  }

  // Fire-and-forget: this process stays alive after the request (PM2, not serverless), so the
  // recap finishes generating in the background without delaying the coach's redirect below.
  prisma.matchEvent.findMany({ where: { matchId }, orderBy: { createdAt: 'asc' }, select: { label: true } })
    .then((allEvents) => generateMatchRecap(
      match.homeTeam.name, match.awayTeam.name, homeScore, awayScore, allEvents.map((e) => e.label),
    ))
    .then((recap) => {
      if (!recap) return
      return prisma.newsPost.create({
        data: {
          title:    `${match.homeTeam.name} ${homeScore} - ${awayScore} ${match.awayTeam.name}`,
          body:     recap,
          authorId: session.coachId,
          matchId,
        },
      })
    })
    .catch((err) => console.error('Match recap generation failed:', err))

  revalidatePath('/')
  revalidatePath('/league-management')
  revalidatePath(`/teams/${match.homeTeamId}`)
  revalidatePath(`/teams/${match.awayTeamId}`)

  redirect(`/teams/${match.homeTeamId}`)
}
