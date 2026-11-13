import PodcastPlayer from '../PodcastPlayer'

type Props = { searchParams: Promise<{ ep?: string; t?: string }> }

export default async function HobbyPlayerPage({ searchParams }: Props) {
  const { ep, t } = await searchParams
  const initialIndex = ep ? parseInt(ep, 10) : 0
  const initialTime  = t ? parseInt(t, 10) : 0

  return (
    <div className="min-h-screen bg-bb-navy">
      <div className="max-w-md mx-auto px-4 py-8">
        <PodcastPlayer
          initialIndex={isNaN(initialIndex) ? 0 : initialIndex}
          initialTime={isNaN(initialTime) ? 0 : initialTime}
          showPopOut={false}
        />
      </div>
    </div>
  )
}
