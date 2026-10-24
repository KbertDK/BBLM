import prisma from '@/lib/prisma'
import { NewsPostSummary } from '@/lib/types'

const ARCHIVE_PAGE_SIZE = 20

function mapPost(p: { id: string; title: string; body: string; coachNote: string; author: { name: string }; createdAt: Date }): NewsPostSummary {
  return {
    id:         p.id,
    title:      p.title,
    excerpt:    p.body.length > 220 ? p.body.slice(0, 220) + '…' : p.body,
    body:       p.body,
    coachNote:  p.coachNote,
    authorName: p.author.name,
    createdAt:  p.createdAt,
  }
}

export async function getLatestNews(): Promise<NewsPostSummary[]> {
  const posts = await prisma.newsPost.findMany({
    orderBy: { createdAt: 'desc' },
    take: 8,
    include: { author: { select: { name: true } } },
  })
  return posts.map(mapPost)
}

export async function getNewsArchive(page: number): Promise<{ posts: NewsPostSummary[]; total: number; pageSize: number }> {
  const [posts, total] = await Promise.all([
    prisma.newsPost.findMany({
      orderBy: { createdAt: 'desc' },
      skip:    (page - 1) * ARCHIVE_PAGE_SIZE,
      take:    ARCHIVE_PAGE_SIZE,
      include: { author: { select: { name: true } } },
    }),
    prisma.newsPost.count(),
  ])
  return { posts: posts.map(mapPost), total, pageSize: ARCHIVE_PAGE_SIZE }
}

export async function getTeamNews(teamId: string) {
  return prisma.newsPost.findMany({
    where:   { teamId },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true, alias: true } } },
  })
}
