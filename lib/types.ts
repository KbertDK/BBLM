export interface NewsPostSummary {
  id: string
  title: string
  excerpt: string
  body: string
  coachNote: string
  authorName: string
  createdAt: Date
}

export interface MatchEventSummary {
  id:    string
  type:  string
  label: string
}

export interface MatchSummary {
  id: string
  round: number
  homeTeamName: string
  awayTeamName: string
  scheduledAt: Date | null
  homeScore: number | null
  awayScore: number | null
  recentEvents?: MatchEventSummary[]
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
