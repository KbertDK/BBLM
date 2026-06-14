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
