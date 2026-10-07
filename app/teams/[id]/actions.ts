'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { skillRollsAvailable, improvementOptions, canIncreaseStat, VALUE_MODIFIERS, type StatName } from '@/lib/ssp'

async function requireOwner(teamId: string) {
  const session = await getSession()
  if (!session) return null
  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { coachId: true } })
  if (!team || team.coachId !== session.coachId) return null
  return { session, team }
}

export async function updatePlayer(formData: FormData) {
  const session = await getSession()
  if (!session) return

  const playerId = formData.get('playerId') as string
  const name     = ((formData.get('name') as string) ?? '').trim() || null
  const number   = parseInt((formData.get('number') as string) ?? '', 10)

  if (!playerId || isNaN(number) || number < 1 || number > 99) return

  const player = await prisma.teamPlayer.findUnique({
    where:  { id: playerId },
    select: { teamId: true, team: { select: { coachId: true } } },
  })
  if (!player || player.team.coachId !== session.coachId) return

  const conflict = await prisma.teamPlayer.findFirst({
    where:  { teamId: player.teamId, number, id: { not: playerId } },
    select: { id: true },
  })
  if (conflict) redirect(`/teams/${player.teamId}?err=dup_number`)

  await prisma.teamPlayer.update({
    where: { id: playerId },
    data:  { name, number },
  })

  revalidatePath(`/teams/${player.teamId}`)
}

export async function updateTeamInfo(formData: FormData) {
  const session = await getSession()
  if (!session) return

  const teamId = formData.get('teamId') as string
  if (!teamId) return

  const team = await prisma.team.findUnique({ where: { id: teamId }, select: { coachId: true } })
  if (!team || team.coachId !== session.coachId) return

  const treasury         = Math.max(0, parseInt((formData.get('treasury')         as string) ?? '0', 10) || 0)
  const rerolls          = Math.min(8, Math.max(0, parseInt((formData.get('rerolls')  as string) ?? '0', 10) || 0))
  const assistantCoaches = Math.max(0, parseInt((formData.get('assistantCoaches') as string) ?? '0', 10) || 0)
  const cheerleaders     = Math.max(0, parseInt((formData.get('cheerleaders')     as string) ?? '0', 10) || 0)
  const fanFactor        = Math.max(0, parseInt((formData.get('fanFactor')        as string) ?? '0', 10) || 0)
  const apothecary       = formData.get('apothecary') === 'true'

  await prisma.team.update({
    where: { id: teamId },
    data:  { treasury, rerolls, assistantCoaches, cheerleaders, fanFactor, apothecary },
  })

  revalidatePath(`/teams/${teamId}`)
}

// ── Team management ───────────────────────────────────────────────────────────

export async function deleteTeam(formData: FormData) {
  const teamId = formData.get('teamId') as string
  if (!await requireOwner(teamId)) return

  // Block if the team appears in any match (scheduled or played)
  const matchCount = await prisma.match.count({
    where: { OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }] },
  })
  if (matchCount > 0) return

  await prisma.team.delete({ where: { id: teamId } })
  redirect('/teams')
}

export async function deactivateTeam(formData: FormData) {
  const teamId = formData.get('teamId') as string
  if (!await requireOwner(teamId)) return
  await prisma.team.update({ where: { id: teamId }, data: { isActive: false } })
  revalidatePath(`/teams/${teamId}`)
}

export async function activateTeam(formData: FormData) {
  const teamId = formData.get('teamId') as string
  if (!await requireOwner(teamId)) return
  await prisma.team.update({ where: { id: teamId }, data: { isActive: true } })
  revalidatePath(`/teams/${teamId}`)
}

export async function assignTeam(formData: FormData) {
  const teamId        = formData.get('teamId')  as string
  const newCoachId    = formData.get('coachId') as string
  if (!teamId || !newCoachId) return
  if (!await requireOwner(teamId)) return

  const target = await prisma.coach.findUnique({ where: { id: newCoachId }, select: { isActive: true } })
  if (!target?.isActive) return

  await prisma.team.update({ where: { id: teamId }, data: { coachId: newCoachId } })
  revalidatePath(`/teams/${teamId}`)
  redirect(`/teams/${teamId}`)
}

// ── Roster actions ────────────────────────────────────────────────────────────

export async function buyPlayer(formData: FormData) {
  const teamId       = formData.get('teamId')       as string
  const playerTypeId = formData.get('playerTypeId') as string
  const number       = parseInt((formData.get('number') as string) ?? '', 10)

  if (!teamId || !playerTypeId || isNaN(number) || number < 1 || number > 99) return
  if (!await requireOwner(teamId)) return

  const [team, playerType] = await Promise.all([
    prisma.team.findUnique({
      where:  { id: teamId },
      select: {
        treasury: true,
        raceId:   true,
        league:   { select: { ruleSet: { select: { numberOfPlayers: true } } } },
        players:  { where: { status: { in: ['ACTIVE', 'MNG'] } }, select: { playerTypeId: true } },
      },
    }),
    prisma.playerType.findUnique({
      where:  { id: playerTypeId },
      select: { id: true, cost: true, maxCount: true, raceId: true },
    }),
  ])

  if (!team || !playerType) return
  if (playerType.raceId !== team.raceId) return

  const maxSlots  = team.league.ruleSet?.numberOfPlayers ?? 16
  const living    = team.players
  if (living.length >= maxSlots) return

  const typeCount = living.filter((p) => p.playerTypeId === playerTypeId).length
  if (typeCount >= playerType.maxCount) return
  if (team.treasury < playerType.cost) return

  // Block duplicate jersey number
  const conflict = await prisma.teamPlayer.findFirst({ where: { teamId, number } })
  if (conflict) return

  await prisma.$transaction([
    prisma.teamPlayer.create({ data: { teamId, playerTypeId, number, status: 'ACTIVE', value: 0 } }),
    prisma.team.update({ where: { id: teamId }, data: { treasury: { decrement: playerType.cost } } }),
  ])

  revalidatePath(`/teams/${teamId}`)
}

export async function sackPlayer(formData: FormData) {
  const playerId = formData.get('playerId') as string
  if (!playerId) return

  const player = await prisma.teamPlayer.findUnique({
    where:  { id: playerId },
    select: { teamId: true, status: true, team: { select: { wins: true, draws: true, losses: true } } },
  })
  if (!player || !['ACTIVE', 'MNG'].includes(player.status)) return
  if (!await requireOwner(player.teamId)) return

  const totalGames = player.team.wins + player.team.draws + player.team.losses

  await prisma.teamPlayer.update({
    where: { id: playerId },
    data:  { status: 'SACKED', teamGamesAtSack: totalGames },
  })

  revalidatePath(`/teams/${player.teamId}`)
}

export async function recordSkillRoll(formData: FormData) {
  const playerId = formData.get('playerId') as string
  const die1 = parseInt((formData.get('die1') as string) ?? '', 10)
  const die2 = parseInt((formData.get('die2') as string) ?? '', 10)
  if (!playerId || isNaN(die1) || isNaN(die2) || die1 < 1 || die1 > 6 || die2 < 1 || die2 > 6) return

  const player = await prisma.teamPlayer.findUnique({
    where:  { id: playerId },
    select: { teamId: true, ssp: true, _count: { select: { skillRolls: true } } },
  })
  if (!player) return
  if (!await requireOwner(player.teamId)) return
  if (skillRollsAvailable(player.ssp, player._count.skillRolls) <= 0) return

  await prisma.skillRoll.create({ data: { teamPlayerId: playerId, die1, die2 } })
  revalidatePath(`/teams/${player.teamId}`)
}

export async function pickSkill(formData: FormData) {
  const rollId  = formData.get('rollId') as string
  const skillId = formData.get('skillId') as string
  if (!rollId || !skillId) return

  const roll = await prisma.skillRoll.findUnique({
    where:  { id: rollId },
    select: { id: true, consumed: true, teamPlayerId: true, teamPlayer: { select: { teamId: true, playerType: { select: { skillRollNormal: true } } } } },
  })
  if (!roll || roll.consumed) return
  if (!await requireOwner(roll.teamPlayer.teamId)) return

  const skill = await prisma.skill.findUnique({ where: { id: skillId }, select: { category: true } })
  if (!skill) return

  // CRP1 Value Modifiers Table: a skill only accessible via a Double roll is worth more.
  const isNormal       = roll.teamPlayer.playerType.skillRollNormal.includes(skill.category)
  const valueIncrease  = isNormal ? VALUE_MODIFIERS.normalSkill : VALUE_MODIFIERS.doubleSkill

  await prisma.$transaction([
    prisma.teamPlayer.update({
      where: { id: roll.teamPlayerId },
      data:  { learnedSkills: { connect: { id: skillId } }, value: { increment: valueIncrease } },
    }),
    prisma.skillRoll.update({ where: { id: rollId }, data: { consumed: true } }),
  ])

  revalidatePath(`/teams/${roll.teamPlayer.teamId}`)
}

export async function pickStatIncrease(formData: FormData) {
  const rollId = formData.get('rollId') as string
  const stat   = formData.get('stat') as StatName
  if (!rollId || !(['MA', 'ST', 'AG', 'AV'] as const).includes(stat)) return

  const roll = await prisma.skillRoll.findUnique({
    where:  { id: rollId },
    select: {
      id: true, consumed: true, die1: true, die2: true, teamPlayerId: true,
      teamPlayer: {
        select: {
          teamId: true, maIncrease: true, stIncrease: true, agIncrease: true, avIncrease: true,
          playerType: { select: { ma: true, st: true, ag: true, av: true } },
        },
      },
    },
  })
  if (!roll || roll.consumed) return
  if (!await requireOwner(roll.teamPlayer.teamId)) return

  const { statOptions } = improvementOptions(roll.die1, roll.die2)
  if (!statOptions.includes(stat)) return

  const base    = { MA: roll.teamPlayer.playerType.ma, ST: roll.teamPlayer.playerType.st, AG: roll.teamPlayer.playerType.ag, AV: roll.teamPlayer.playerType.av }[stat]
  const current = { MA: roll.teamPlayer.maIncrease,    ST: roll.teamPlayer.stIncrease,    AG: roll.teamPlayer.agIncrease,    AV: roll.teamPlayer.avIncrease }[stat]
  if (!canIncreaseStat(base, current)) return

  const fieldMap: Record<StatName, 'maIncrease' | 'stIncrease' | 'agIncrease' | 'avIncrease'> = {
    MA: 'maIncrease', ST: 'stIncrease', AG: 'agIncrease', AV: 'avIncrease',
  }
  const field = fieldMap[stat]

  await prisma.$transaction([
    prisma.teamPlayer.update({
      where: { id: roll.teamPlayerId },
      data:  { [field]: { increment: 1 }, value: { increment: VALUE_MODIFIERS[stat] } },
    }),
    prisma.skillRoll.update({ where: { id: rollId }, data: { consumed: true } }),
  ])

  revalidatePath(`/teams/${roll.teamPlayer.teamId}`)
}

export async function signJourneyman(formData: FormData) {
  const journeymanId = formData.get('journeymanId') as string
  if (!journeymanId) return

  const journeyman = await prisma.matchJourneyman.findUnique({
    where:  { id: journeymanId },
    select: {
      id: true, resolved: true, injuryStatus: true, side: true,
      touchdowns: true, completePasses: true, interceptions: true, casualties: true, mvp: true, ssp: true,
      playerTypeId: true,
      playerType: { select: { cost: true, maxCount: true, raceId: true } },
      match: { select: { homeTeamId: true, awayTeamId: true } },
    },
  })
  if (!journeyman || journeyman.resolved || journeyman.injuryStatus === 'DEAD') return

  const teamId = journeyman.side === 'home' ? journeyman.match.homeTeamId : journeyman.match.awayTeamId
  if (!await requireOwner(teamId)) return

  const team = await prisma.team.findUnique({
    where:  { id: teamId },
    select: {
      treasury: true,
      league:   { select: { ruleSet: { select: { numberOfPlayers: true } } } },
      players:  { where: { status: { in: ['ACTIVE', 'MNG'] } }, select: { number: true, playerTypeId: true } },
    },
  })
  if (!team) return

  const maxSlots = team.league.ruleSet?.numberOfPlayers ?? 16
  if (team.players.length >= maxSlots) return
  const typeCount = team.players.filter((p) => p.playerTypeId === journeyman.playerTypeId).length
  if (typeCount >= journeyman.playerType.maxCount) return
  if (team.treasury < journeyman.playerType.cost) return

  const usedNumbers = new Set(team.players.map((p) => p.number))
  let number = 1
  while (usedNumbers.has(number) && number <= 99) number++
  if (number > 99) return

  await prisma.$transaction([
    prisma.teamPlayer.create({
      data: {
        teamId, playerTypeId: journeyman.playerTypeId, number,
        status: journeyman.injuryStatus,
        touchdowns: journeyman.touchdowns, completePasses: journeyman.completePasses,
        interceptions: journeyman.interceptions, casualties: journeyman.casualties,
        mvp: journeyman.mvp, ssp: journeyman.ssp,
        value: journeyman.playerType.cost,
      },
    }),
    prisma.team.update({ where: { id: teamId }, data: { treasury: { decrement: journeyman.playerType.cost } } }),
    prisma.matchJourneyman.update({ where: { id: journeymanId }, data: { resolved: true } }),
  ])

  revalidatePath(`/teams/${teamId}`)
}

export async function fireJourneyman(formData: FormData) {
  const journeymanId = formData.get('journeymanId') as string
  if (!journeymanId) return

  const journeyman = await prisma.matchJourneyman.findUnique({
    where:  { id: journeymanId },
    select: { resolved: true, side: true, match: { select: { homeTeamId: true, awayTeamId: true } } },
  })
  if (!journeyman || journeyman.resolved) return

  const teamId = journeyman.side === 'home' ? journeyman.match.homeTeamId : journeyman.match.awayTeamId
  if (!await requireOwner(teamId)) return

  await prisma.matchJourneyman.update({ where: { id: journeymanId }, data: { resolved: true } })
  revalidatePath(`/teams/${teamId}`)
}

export async function reinstatePlayer(formData: FormData) {
  const playerId = formData.get('playerId') as string
  if (!playerId) return

  const player = await prisma.teamPlayer.findUnique({
    where:  { id: playerId },
    select: {
      teamId:          true,
      status:          true,
      teamGamesAtSack: true,
      team: {
        select: {
          wins: true, draws: true, losses: true,
          league: { select: { ruleSet: { select: { numberOfPlayers: true } } } },
          players: { where: { status: { in: ['ACTIVE', 'MNG'] } }, select: { id: true } },
        },
      },
    },
  })
  if (!player || player.status !== 'SACKED') return
  if (!await requireOwner(player.teamId)) return

  const totalGames = player.team.wins + player.team.draws + player.team.losses
  if (totalGames !== player.teamGamesAtSack) return

  const maxSlots = player.team.league.ruleSet?.numberOfPlayers ?? 16
  if (player.team.players.length >= maxSlots) return

  await prisma.teamPlayer.update({
    where: { id: playerId },
    data:  { status: 'ACTIVE', teamGamesAtSack: null },
  })

  revalidatePath(`/teams/${player.teamId}`)
}

export async function killPlayer(formData: FormData) {
  const playerId = formData.get('playerId') as string
  if (!playerId) return

  const player = await prisma.teamPlayer.findUnique({
    where:  { id: playerId },
    select: {
      teamId:    true,
      status:    true,
      name:      true,
      playerType:{ select: { name: true } },
      team:      { select: { name: true, coachId: true } },
    },
  })
  if (!player || !['ACTIVE', 'MNG'].includes(player.status)) return

  const ctx = await requireOwner(player.teamId)
  if (!ctx) return

  const playerName   = player.name?.trim() || 'An unnamed warrior'
  const positionName = player.playerType.name
  const teamName     = player.team.name

  await prisma.$transaction([
    prisma.teamPlayer.update({ where: { id: playerId }, data: { status: 'DEAD' } }),
    prisma.newsPost.create({
      data: {
        title:    `${playerName} of ${teamName} has fallen!`,
        body:     `${playerName}, ${positionName} for ${teamName}, was slain on the Blood Bowl pitch. They will be remembered — and mourned — by those brave enough to take the field after them.`,
        authorId: ctx.session.coachId,
        teamId:   player.teamId,
        playerId,
      },
    }),
  ])

  revalidatePath(`/teams/${player.teamId}`)
  revalidatePath('/')
}

export async function createTeamNewsPost(formData: FormData) {
  const teamId = formData.get('teamId') as string
  const title  = ((formData.get('title') as string) ?? '').trim()
  const body   = ((formData.get('body')  as string) ?? '').trim()
  if (!teamId || !title || !body) return

  const ctx = await requireOwner(teamId)
  if (!ctx) return

  await prisma.newsPost.create({
    data: { title, body, authorId: ctx.session.coachId, teamId },
  })

  revalidatePath(`/teams/${teamId}`)
  revalidatePath('/')
}

export async function appendTeamNewsNote(formData: FormData) {
  const postId = formData.get('postId') as string
  const note   = ((formData.get('note') as string) ?? '').trim()
  if (!postId) return

  const post = await prisma.newsPost.findUnique({ where: { id: postId }, select: { teamId: true } })
  if (!post?.teamId) return
  if (!await requireOwner(post.teamId)) return

  await prisma.newsPost.update({ where: { id: postId }, data: { coachNote: note } })

  revalidatePath(`/teams/${post.teamId}`)
  revalidatePath('/')
}
