// CRP1 Team Value: roster players (at current value, falling back to listed cost) plus
// rerolls, staff and apothecary. `extraValue` folds in anything additional (this match's
// journeymen/mercs/stars) for computing the team's FINAL value once Inducements are settled.
//
// IMPORTANT: do not use `extraValue` when computing the basis for the Inducement gold gap —
// that gap must be struck from the permanent roster alone (CRP1: "the amount of gold the team
// receives is equal to the difference between the total value of the underdog team and the
// total value of the opposing team"), a fixed snapshot taken before any of this match's
// temporary hires exist. Feeding the evolving (post-purchase) value back into the gap shrinks
// it as the team spends, effectively charging each purchase twice.
export function computeTV(team: {
  players:          { status: string; value: number; playerType: { cost: number } }[]
  rerolls:          number
  race:             { rerollPrice: number }
  assistantCoaches: number
  cheerleaders:     number
  fanFactor:        number
  apothecary:       boolean
}, extraValue = 0): number {
  const playerValue = team.players
    .filter((p) => p.status === 'ACTIVE')
    .reduce((s, p) => s + (p.value > 0 ? p.value : p.playerType.cost), 0)
  return Math.round(
    (playerValue + extraValue +
      team.rerolls          * team.race.rerollPrice +
      team.assistantCoaches * 10000 +
      team.cheerleaders     * 10000 +
      team.fanFactor        * 10000 +
      (team.apothecary ? 50000 : 0)) /
    1000,
  )
}
