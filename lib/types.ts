export interface NewsPostSummary {
  id: string
  title: string
  excerpt: string
  authorName: string
  createdAt: Date
}

export interface MatchSummary {
  id: string
  round: number
  homeTeamName: string
  awayTeamName: string
  scheduledAt: Date
  homeScore: number | null
  awayScore: number | null
}

export interface MatchResult extends MatchSummary {
  homeScore: number
  awayScore: number
  winnerId: string | null
  homeTeamId: string
  awayTeamId: string
}

export interface TeamSummary {
  id: string
  name: string
  race: string
  wins: number
  losses: number
  draws: number
}
