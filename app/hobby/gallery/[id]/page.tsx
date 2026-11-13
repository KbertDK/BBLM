import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getSession } from '@/lib/auth'
import { getGalleryPosts } from '@/lib/queries/gallery'
import DeleteGalleryButton from '../../DeleteGalleryButton'

export const revalidate = 0

type Props = { params: Promise<{ id: string }> }

export default async function GalleryViewerPage({ params }: Props) {
  const { id } = await params
  const [session, posts] = await Promise.all([
    getSession(),
    getGalleryPosts(),
  ])

  const index = posts.findIndex((p) => p.id === id)
  if (index === -1) notFound()

  const post = posts[index]
  const prev = posts[index - 1]
  const next = posts[index + 1]

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <header className="shrink-0 flex items-center justify-between gap-4 px-4 sm:px-6 py-3 border-b border-bb-border/40">
        <Link href="/hobby" className="text-xs text-bb-muted hover:text-bb-gold transition-colors font-heading uppercase tracking-widest">
          ← Back to Gallery
        </Link>
        <p className="text-[11px] text-bb-muted/60 font-heading uppercase tracking-widest">
          {index + 1} / {posts.length}
        </p>
      </header>

      <main className="flex-1 flex items-center justify-center relative px-4 py-6 min-h-0">
        {prev && (
          <Link
            href={`/hobby/gallery/${prev.id}`}
            className="absolute left-2 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 border border-bb-border/60 text-white hover:border-bb-gold/60 hover:text-bb-gold transition-colors text-lg"
            aria-label="Previous picture"
          >‹</Link>
        )}

        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={post.imageUrl}
          alt={post.description}
          className="max-h-[75vh] max-w-full object-contain rounded-sm"
        />

        {next && (
          <Link
            href={`/hobby/gallery/${next.id}`}
            className="absolute right-2 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center rounded-full bg-black/60 border border-bb-border/60 text-white hover:border-bb-gold/60 hover:text-bb-gold transition-colors text-lg"
            aria-label="Next picture"
          >›</Link>
        )}
      </main>

      <footer className="shrink-0 px-4 sm:px-6 py-4 border-t border-bb-border/40 text-center">
        <p className="text-sm text-white mb-1">{post.description}</p>
        <p className="text-[11px] text-bb-muted/60">
          by {post.coach.alias ?? post.coach.name} · {post.createdAt.toLocaleDateString()}
        </p>
        {session?.coachId === post.coachId && (
          <div className="mt-2">
            <DeleteGalleryButton postId={post.id} redirectTo="/hobby" />
          </div>
        )}
      </footer>
    </div>
  )
}
