'use server'

import { revalidatePath } from 'next/cache'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'
import { publishCommishNewsNow } from '@/lib/commishNews'

async function requireCommish() {
  const session = await getSession()
  if (!session || (session.role !== 'COMMISH' && session.role !== 'ADMIN')) return null
  return session
}

export async function createCommishNews(formData: FormData) {
  const session = await requireCommish()
  if (!session) return

  const title  = (formData.get('title') as string)?.trim()
  const body   = (formData.get('body') as string)?.trim()
  const status = formData.get('status') as string
  const scheduledAtRaw = formData.get('scheduledAt') as string | null

  if (!title || !body) return
  if (!['draft', 'scheduled', 'published'].includes(status)) return

  if (status === 'scheduled') {
    if (!scheduledAtRaw) return
    const scheduledAt = new Date(scheduledAtRaw)
    if (isNaN(scheduledAt.getTime())) return

    await prisma.commishNews.create({
      data: { title, body, authorId: session.coachId, status: 'SCHEDULED', scheduledAt },
    })
  } else if (status === 'published') {
    const created = await prisma.commishNews.create({
      data: { title, body, authorId: session.coachId, status: 'DRAFT' },
    })
    await publishCommishNewsNow(created.id)
    revalidatePath('/')
    revalidatePath('/news')
  } else {
    await prisma.commishNews.create({
      data: { title, body, authorId: session.coachId, status: 'DRAFT' },
    })
  }

  revalidatePath('/league-management')
}

export async function updateCommishNews(formData: FormData) {
  if (!await requireCommish()) return

  const id     = formData.get('id') as string
  const title  = (formData.get('title') as string)?.trim()
  const body   = (formData.get('body') as string)?.trim()
  const status = formData.get('status') as string
  const scheduledAtRaw = formData.get('scheduledAt') as string | null

  if (!id || !title || !body) return
  if (!['draft', 'scheduled'].includes(status)) return

  const existing = await prisma.commishNews.findUnique({ where: { id }, select: { status: true } })
  if (!existing || existing.status === 'PUBLISHED') return

  if (status === 'scheduled') {
    if (!scheduledAtRaw) return
    const scheduledAt = new Date(scheduledAtRaw)
    if (isNaN(scheduledAt.getTime())) return

    await prisma.commishNews.update({
      where: { id },
      data:  { title, body, status: 'SCHEDULED', scheduledAt },
    })
  } else {
    await prisma.commishNews.update({
      where: { id },
      data:  { title, body, status: 'DRAFT', scheduledAt: null },
    })
  }

  revalidatePath('/league-management')
}

export async function publishCommishNewsNowAction(formData: FormData) {
  if (!await requireCommish()) return

  const id = formData.get('id') as string
  if (!id) return

  await publishCommishNewsNow(id)

  revalidatePath('/league-management')
  revalidatePath('/')
  revalidatePath('/news')
}

export async function deleteCommishNews(formData: FormData) {
  if (!await requireCommish()) return

  const id = formData.get('id') as string
  if (!id) return

  const existing = await prisma.commishNews.findUnique({ where: { id }, select: { status: true } })
  if (!existing || existing.status === 'PUBLISHED') return

  await prisma.commishNews.delete({ where: { id } })
  revalidatePath('/league-management')
}
