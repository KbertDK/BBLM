import prisma from '@/lib/prisma'

export async function getGalleryPosts() {
  return prisma.galleryPost.findMany({
    orderBy: { createdAt: 'desc' },
    include: { coach: { select: { name: true, alias: true } } },
  })
}
