import prisma from '@/lib/prisma'

// A match "locks" its teams' rosters/treasury the moment its pre-match wizard has begun
// (earliest possible write: the weather roll) and stays locked through LIVE, until its
// post-match step sets status to COMPLETED — regardless of win/loss history.
//
// Pass `excludeMatchId` to ask "is this team active in some *other* match?" — used when
// checking whether a team may enter this same match's active lifecycle in the first place.
export async function hasActiveMatch(teamId: string, excludeMatchId?: string): Promise<boolean> {
  const match = await prisma.match.findFirst({
    where: {
      OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      ...(excludeMatchId ? { id: { not: excludeMatchId } } : {}),
      AND: { OR: [{ status: 'LIVE' }, { status: 'SCHEDULED', weatherMdMatchEventId: { not: null } }] },
    },
    select: { id: true },
  })
  return !!match
}

interface ParticipantSession {
  coachId: string
  role:    'ADMIN' | 'COMMISH' | 'COACH'
}

interface MatchCoaches {
  homeTeam: { coachId: string }
  awayTeam: { coachId: string }
}

// Only the two teams' coaches, Admins, and Commishes may view or act on a match's Game On app.
export function isMatchParticipant(session: ParticipantSession | null, match: MatchCoaches): boolean {
  if (!session) return false
  return (
    session.coachId === match.homeTeam.coachId ||
    session.coachId === match.awayTeam.coachId ||
    session.role === 'COMMISH' ||
    session.role === 'ADMIN'
  )
}

// Which side of the match this session is — 'neutral' for Admin/Commish (full visibility,
// no side ownership), null if they're not a participant at all. Used both to gate side-specific
// actions (a coach may only act on their own side) and to decide what to redact in the display
// (an opposing coach's pre-kickoff purchases).
export function resolveViewerSide(
  session: ParticipantSession | null,
  match: MatchCoaches,
): 'home' | 'away' | 'neutral' | null {
  if (!session) return null
  if (session.role === 'ADMIN' || session.role === 'COMMISH') return 'neutral'
  if (session.coachId === match.homeTeam.coachId) return 'home'
  if (session.coachId === match.awayTeam.coachId) return 'away'
  return null
}
