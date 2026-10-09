// CRP1 Petty Cash accounting: only UNSPENT Petty Cash returns to treasury — inducement
// gold from the Team Value gap is "use it or lose it" and never returns either way.
// Shared by the server commit (completeMatchFull) and the client preview (GameOnClient).
export function computePettyCashReturn(input: {
  homeTeamValue: number
  awayTeamValue: number
  homePettyCash: number
  awayPettyCash: number
  homeSpent: number
  awaySpent: number
}): { homePettyCashReturned: number; awayPettyCashReturned: number } {
  const { homeTeamValue, awayTeamValue, homePettyCash, awayPettyCash, homeSpent, awaySpent } = input

  const homeBase = homeTeamValue + homePettyCash / 1000
  const awayBase = awayTeamValue + awayPettyCash / 1000
  const inducementGp  = Math.round(Math.abs(homeBase - awayBase) * 1000)
  const receivingSide = homeBase < awayBase ? 'home' : awayBase < homeBase ? 'away' : null

  const homePettyCashSpent = Math.max(0, homeSpent - (receivingSide === 'home' ? inducementGp : 0))
  const awayPettyCashSpent = Math.max(0, awaySpent - (receivingSide === 'away' ? inducementGp : 0))

  return {
    homePettyCashReturned: Math.max(0, homePettyCash - homePettyCashSpent),
    awayPettyCashReturned: Math.max(0, awayPettyCash - awayPettyCashSpent),
  }
}
