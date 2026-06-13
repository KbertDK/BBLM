import { NewsPostSummary } from '@/lib/types'
import SectionHeading from '@/components/ui/SectionHeading'
import NewsCard from './NewsCard'

interface Props {
  posts: NewsPostSummary[]
}

export default function NewsSection({ posts }: Props) {
  return (
    <section>
      <SectionHeading title="League Dispatch" subtitle="Latest news from the dugouts and terraces" />
      {posts.length === 0 ? (
        <p className="text-bb-muted text-center italic">No news posted yet.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {posts.map((post) => (
            <NewsCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </section>
  )
}
