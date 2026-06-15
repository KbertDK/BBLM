export const dynamic = 'force-dynamic'

import { getLiveMatches } from '@/lib/queries/matches'
import SportBarScoreboard from '@/components/scoreboard/SportBarScoreboard'

export default async function ScoreboardPage() {
  const matches = await getLiveMatches()
  return <SportBarScoreboard initialMatches={matches} />
}
