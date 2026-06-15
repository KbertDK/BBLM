'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { NewsPostSummary } from '@/lib/types'
import SectionHeading from '@/components/ui/SectionHeading'
import NewsCard from './NewsCard'

interface Props {
  posts: NewsPostSummary[]
}

export default function NewsSection({ posts }: Props) {
  const [active, setActive] = useState<NewsPostSummary | null>(null)

  // Lock body scroll and handle ESC while modal is open
  useEffect(() => {
    if (!active) return
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setActive(null) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', onKey)
    }
  }, [active])

  return (
    <section>
      <SectionHeading title="League Dispatch" subtitle="Latest news from the dugouts and terraces" />

      {posts.length === 0 ? (
        <p className="text-bb-muted text-center italic">No news posted yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {posts.map((post) => (
            <NewsCard key={post.id} post={post} onClick={() => setActive(post)} />
          ))}
        </div>
      )}

      {/* Modal */}
      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
          onClick={() => setActive(null)}
        >
          <div
            className="relative w-full max-w-2xl max-h-[85vh] flex flex-col bg-bb-dark border border-bb-gold/30 rounded-sm shadow-2xl shadow-black/80"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-bb-border shrink-0">
              <div className="min-w-0">
                <h2 className="font-heading font-bold text-bb-gold text-xl leading-snug">
                  {active.title}
                </h2>
                <p className="text-[11px] text-bb-muted/60 mt-1.5 font-heading tracking-widest uppercase">
                  {active.authorName}
                  <span className="mx-2 text-bb-border">·</span>
                  {format(new Date(active.createdAt), 'd MMM yyyy · HH:mm')}
                </p>
              </div>
              <button
                onClick={() => setActive(null)}
                className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-sm border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted transition-colors mt-0.5"
                aria-label="Close"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 px-6 py-5 space-y-4">
              <p className="text-sm text-bb-muted leading-relaxed whitespace-pre-wrap">
                {active.body}
              </p>

              {active.coachNote && (
                <div className="pt-4 border-t border-bb-border/40">
                  <p className="text-[10px] text-bb-muted/50 uppercase tracking-widest mb-2 font-heading">
                    Coach&apos;s Note
                  </p>
                  <p className="text-sm text-white/70 italic leading-relaxed">
                    {active.coachNote}
                  </p>
                </div>
              )}
            </div>

            {/* Modal footer */}
            <div className="px-6 py-3 border-t border-bb-border/40 shrink-0 flex justify-end">
              <button
                onClick={() => setActive(null)}
                className="text-xs font-heading uppercase tracking-widest px-4 py-1.5 rounded-sm border border-bb-border text-bb-muted hover:text-white hover:border-bb-muted transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
