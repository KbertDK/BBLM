import { MatchSummary, MatchResult } from '@/lib/types'
import SectionHeading from '@/components/ui/SectionHeading'
import UpcomingMatches from './UpcomingMatches'
import LiveMatches from './LiveMatches'
import LatestResults from './LatestResults'

interface Props {
  upcoming: MatchSummary[]
  live: MatchSummary[]
  results: MatchResult[]
}

export default function MatchesPanel({ upcoming, live, results }: Props) {
  return (
    <section>
      <SectionHeading title="The Pitch" subtitle="Fixtures, live action & recent results" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-bb-dark/50 border border-bb-border rounded-sm p-5">
          <UpcomingMatches matches={upcoming} />
        </div>
        <div className="bg-bb-dark/50 border border-bb-crimson/20 rounded-sm p-5">
          <LiveMatches matches={live} />
        </div>
        <div className="bg-bb-dark/50 border border-bb-border rounded-sm p-5">
          <LatestResults results={results} />
        </div>
      </div>
    </section>
  )
}
