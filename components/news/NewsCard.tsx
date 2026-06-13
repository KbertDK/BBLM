import { format } from 'date-fns'
import { NewsPostSummary } from '@/lib/types'
import GrimdarkCard from '@/components/ui/GrimdarkCard'

interface Props {
  post: NewsPostSummary
}

export default function NewsCard({ post }: Props) {
  return (
    <GrimdarkCard className="flex flex-col border-t-2 border-t-bb-gold h-full">
      <div className="p-5 flex flex-col flex-1">
        <div className="text-xs text-bb-muted mb-2 tracking-wide">
          {format(new Date(post.createdAt), 'd MMM yyyy')}
        </div>
        <h3 className="font-heading text-base font-bold text-white leading-snug mb-3 hover:text-bb-gold transition-colors cursor-pointer line-clamp-2">
          {post.title}
        </h3>
        <p className="text-bb-muted text-sm leading-relaxed line-clamp-4 flex-1">
          {post.excerpt}
        </p>
        <div className="mt-4 pt-3 border-t border-bb-border">
          <span className="text-xs text-bb-gold/60 italic">By {post.authorName}</span>
        </div>
      </div>
    </GrimdarkCard>
  )
}
