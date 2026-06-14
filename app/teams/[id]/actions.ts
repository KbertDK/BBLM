'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function updatePlayer(formData: FormData) {
  const session = await getSession()
  if (!session) return

  const playerId = formData.get('playerId') as string
  const name     = ((formData.get('name') as string) ?? '').trim() || null
  const number   = parseInt((formData.get('number') as string) ?? '', 10)
  const mvp      = Math.max(0, parseInt((formData.get('mvp')   as string) ?? '0', 10) || 0)
  const ssp      = Math.max(0, parseInt((formData.get('ssp')   as string) ?? '0', 10) || 0)
  const niggling = ((formData.get('niggling') as string) ?? '').trim().slice(0, 60)
  const value    = Math.max(0, parseInt((formData.get('value') as string) ?? '0', 10) || 0)

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
    data:  { name, number, mvp, ssp, niggling, value },
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
