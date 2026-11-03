import prisma from '@/lib/prisma'

export async function publishCommishNewsNow(id: string): Promise<void> {
  const item = await prisma.commishNews.findUnique({
    where:  { id },
    select: { id: true, title: true, body: true, authorId: true, status: true },
  })
  if (!item || item.status === 'PUBLISHED') return

  const now = new Date()
  const post = await prisma.newsPost.create({
    data: { title: item.title, body: item.body, authorId: item.authorId },
  })
  await prisma.commishNews.update({
    where: { id },
    data:  { status: 'PUBLISHED', publishedAt: now, newsPostId: post.id },
  })
}

export async function publishDueCommishNews(): Promise<void> {
  const due = await prisma.commishNews.findMany({
    where:  { status: 'SCHEDULED', scheduledAt: { lte: new Date() } },
    select: { id: true },
  })
  for (const { id } of due) {
    await publishCommishNewsNow(id)
  }
}
