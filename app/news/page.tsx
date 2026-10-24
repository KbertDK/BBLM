import Link from 'next/link'
import { getNewsArchive } from '@/lib/queries/news'
import NewsSection from '@/components/news/NewsSection'
import SectionHeading from '@/components/ui/SectionHeading'

interface PageProps {
  searchParams: Promise<{ page?: string }>
}

export default async function NewsArchivePage({ searchParams }: PageProps) {
  const { page: pageStr } = await searchParams
  const page = Math.max(1, parseInt(pageStr ?? '1', 10) || 1)
  const { posts, total, pageSize } = await getNewsArchive(page)
  const totalPages = Math.ceil(total / pageSize)

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="mb-8">
          <Link href="/" className="text-bb-muted text-xs font-heading uppercase tracking-widest hover:text-bb-gold transition-colors">
            ← Back to League
          </Link>
        </div>

        <SectionHeading title="News Archive" subtitle="The full record of league dispatches" />

        {posts.length === 0 ? (
          <p className="text-bb-muted text-sm text-center mt-10">No news yet.</p>
        ) : (
          <div className="mt-10">
            <NewsSection posts={posts} />
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 mt-10">
            {page > 1 && (
              <Link href={`/news?page=${page - 1}`}
                className="px-4 py-2 border border-bb-border text-bb-muted text-xs font-heading uppercase tracking-widest hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors">
                ← Previous
              </Link>
            )}
            <span className="text-xs text-bb-muted font-heading">
              Page {page} of {totalPages}
            </span>
            {page < totalPages && (
              <Link href={`/news?page=${page + 1}`}
                className="px-4 py-2 border border-bb-border text-bb-muted text-xs font-heading uppercase tracking-widest hover:text-bb-gold hover:border-bb-gold/40 rounded-sm transition-colors">
                Next →
              </Link>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
