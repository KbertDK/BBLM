'use server'

import { revalidatePath } from 'next/cache'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { getSession } from '@/lib/auth'

export async function uploadGalleryPost(formData: FormData): Promise<{ error?: string } | void> {
  const session = await getSession()
  if (!session) return { error: 'You must be logged in to add a picture.' }

  const description = ((formData.get('description') as string | null) ?? '').trim()
  if (!description) return { error: 'A description is required.' }
  if (description.length > 500) return { error: 'Description is too long — maximum 500 characters.' }

  const file = formData.get('image') as File | null
  if (!file || file.size === 0) return { error: 'No picture selected.' }
  if (file.size > 2 * 1024 * 1024) return { error: 'File too large — maximum 2 MB.' }
  if (!file.type.startsWith('image/')) return { error: 'Only image files are allowed.' }

  const KNOWN_EXTS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])
  const rawExt     = file.name.split('.').pop()?.toLowerCase() ?? ''
  const ext        = KNOWN_EXTS.has(rawExt) ? rawExt : 'jpg'
  const filename   = `${crypto.randomUUID()}.${ext}`

  // Stored outside public/ and served via a dynamic route (/api/gallery-image/[filename]):
  // Next.js's production server snapshots public/ at boot for performance, so files written
  // there at runtime 404 until the process restarts — a dynamic route always reads fresh.
  const dir      = path.join(process.cwd(), 'uploads', 'gallery')
  const filepath = path.join(dir, filename)

  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filepath, Buffer.from(await file.arrayBuffer()))

  await prisma.galleryPost.create({
    data: {
      coachId:     session.coachId,
      imageUrl:    `/api/gallery-image/${filename}`,
      description,
    },
  })

  revalidatePath('/hobby')
}

export async function deleteGalleryPost(postId: string): Promise<{ error?: string } | void> {
  const session = await getSession()
  if (!session) return { error: 'Unauthorized' }

  const post = await prisma.galleryPost.findUnique({
    where:  { id: postId },
    select: { coachId: true, imageUrl: true },
  })
  if (!post || post.coachId !== session.coachId) return { error: 'Unauthorized' }

  await prisma.galleryPost.delete({ where: { id: postId } })
  await fs.unlink(path.join(process.cwd(), 'uploads', 'gallery', path.basename(post.imageUrl))).catch(() => {})

  revalidatePath('/hobby')
}
