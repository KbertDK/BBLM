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

  const rerolls          = Math.min(8,  Math.max(0, parseInt((formData.get('rerolls')          as string) ?? '0', 10) || 0))
  const assistantCoaches = Math.min(12, Math.max(0, parseInt((formData.get('assistantCoaches') as string) ?? '0', 10) || 0))
  const cheerleaders     = Math.min(12, Math.max(0, parseInt((formData.get('cheerleaders')     as string) ?? '0', 10) || 0))
  const fanFactor        = Math.min(99, Math.max(0, parseInt((formData.get('fanFactor')        as string) ?? '0', 10) || 0))
  const apothecaryReq    = formData.get('apothecary') === 'true'

  if (!name || !raceId || !leagueId || !rosterRaw) return

  let roster: { playerTypeId: string; count: number }[]
  try {
    roster = JSON.parse(rosterRaw)
  } catch {
    return
  }
  if (!Array.isArray(roster) || roster.length === 0) return

  // Server-side re-validation against the league's rule set and race
  const [league, race] = await Promise.all([
    prisma.league.findUnique({
      where: { id: leagueId },
      include: { ruleSet: { select: { startIncome: true, numberOfPlayers: true, status: true } } },
    }),
    prisma.race.findUnique({
      where: { id: raceId },
      select: { rerollPrice: true, hasApothecary: true },
    }),
  ])
  if (!league?.ruleSet || league.ruleSet.status !== 'ACTIVE' || !race) return

  const apothecary = apothecaryReq && race.hasApothecary

  const ids     = roster.map((r) => r.playerTypeId)
  const types   = await prisma.playerType.findMany({
    where: { id: { in: ids }, raceId },
    select: { id: true, cost: true, maxCount: true },
  })
  const typeMap = Object.fromEntries(types.map((t) => [t.id, t]))

  let totalCost = 0
  let totalPlayers = 0
  const playerRows: { playerTypeId: string; number: number; value: number }[] = []
  let num = 1

  for (const { playerTypeId, count } of roster) {
    const pt = typeMap[playerTypeId]
    if (!pt || count < 0 || count > pt.maxCount) return
    totalCost    += pt.cost * count
    totalPlayers += count
    for (let i = 0; i < count; i++) playerRows.push({ playerTypeId, number: num++, value: pt.cost })
  }

  const staffCost = rerolls * race.rerollPrice
                  + assistantCoaches * 10000
                  + cheerleaders     * 10000
                  + fanFactor        * 10000
                  + (apothecary      ? 50000 : 0)

  if (totalCost + staffCost > league.ruleSet.startIncome) return
  if (totalPlayers > league.ruleSet.numberOfPlayers)      return

  const team = await prisma.team.create({
    data: {
      name,
      raceId,
      coachId:  session.coachId,
      leagueId,
      rerolls,
      assistantCoaches,
      cheerleaders,
      fanFactor,
      apothecary,
      players:  { create: playerRows },
    },
  })

  redirect(`/teams/${team.id}`)
}
