import prisma from '@/lib/prisma'
import { NewsPostSummary } from '@/lib/types'

export async function getLatestNews(): Promise<NewsPostSummary[]> {
  const posts = await prisma.newsPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 4,
    include: { author: { select: { name: true } } },
  })

  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    excerpt: p.body.length > 220 ? p.body.slice(0, 220) + '…' : p.body,
    authorName: p.author.name,
    createdAt: p.createdAt,
  }))
}
