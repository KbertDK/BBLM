'use client'

import { format } from 'date-fns'
import { NewsPostSummary } from '@/lib/types'
import GrimdarkCard from '@/components/ui/GrimdarkCard'

interface Props {
  post: NewsPostSummary
  onClick: () => void
}

export default function NewsCard({ post, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className="text-left w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-bb-gold/60 rounded-sm"
    >
      <GrimdarkCard className="flex flex-col border-t-2 border-t-bb-gold h-full hover:border-bb-gold/60 hover:bg-bb-dark/80 transition-colors cursor-pointer">
        <div className="p-5 flex flex-col flex-1">
          <div className="text-xs text-bb-muted mb-2 tracking-wide">
            {format(new Date(post.createdAt), 'd MMM yyyy')}
          </div>
          <h3 className="font-heading text-base font-bold text-white leading-snug mb-3 group-hover:text-bb-gold transition-colors line-clamp-2">
            {post.title}
          </h3>
          <p className="text-bb-muted text-sm leading-relaxed line-clamp-4 flex-1">
            {post.excerpt}
          </p>
          <div className="mt-4 pt-3 border-t border-bb-border flex items-center justify-between">
            <span className="text-xs text-bb-gold/60 italic">By {post.authorName}</span>
            <span className="text-[10px] text-bb-muted/40 uppercase tracking-widest font-heading">Read more →</span>
          </div>
        </div>
      </GrimdarkCard>
    </button>
  )
}
