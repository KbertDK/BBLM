'use server'

import { redirect } from 'next/navigation'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function createTeam(formData: FormData) {
  const session = await getSession()
  if (!session) redirect('/auth/login')

  const name      = (formData.get('name')     as string).trim()
  const raceId    =  formData.get('raceId')   as string
  const leagueId  =  formData.get('leagueId') as string
  const rosterRaw = formData.get('roster')    as string

  if (!name || !raceId || !leagueId || !rosterRaw) return

  let roster: { playerTypeId: string; count: number }[]
  try {
    roster = JSON.parse(rosterRaw)
  } catch {
    return
  }
  if (!Array.isArray(roster) || roster.length === 0) return

  // Server-side re-validation against the league's rule set
  const league = await prisma.league.findUnique({
    where: { id: leagueId },
    include: { ruleSet: { select: { startIncome: true, numberOfPlayers: true, status: true } } },
  })
  if (!league?.ruleSet || league.ruleSet.status !== 'ACTIVE') return

  const ids     = roster.map((r) => r.playerTypeId)
  const types   = await prisma.playerType.findMany({
    where: { id: { in: ids }, raceId },
    select: { id: true, cost: true, maxCount: true },
  })
  const typeMap = Object.fromEntries(types.map((t) => [t.id, t]))

  let totalCost = 0
  let totalPlayers = 0
  const playerRows: { playerTypeId: string; number: number }[] = []
  let num = 1

  for (const { playerTypeId, count } of roster) {
    const pt = typeMap[playerTypeId]
    if (!pt || count < 0 || count > pt.maxCount) return
    totalCost    += pt.cost * count
    totalPlayers += count
    for (let i = 0; i < count; i++) playerRows.push({ playerTypeId, number: num++ })
  }

  if (totalCost > league.ruleSet.startIncome)     return
  if (totalPlayers > league.ruleSet.numberOfPlayers) return

  const team = await prisma.team.create({
    data: {
      name,
      raceId,
      coachId:  session.coachId,
      leagueId,
      players:  { create: playerRows },
    },
  })

  redirect(`/teams/${team.id}`)
}
