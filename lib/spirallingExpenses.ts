// CRP1 default Spiralling Expenses table: 1,750k TV -> 10,000gp, +10,000gp every +150,000 TV.
export const DEFAULT_SPIRALLING_EXPENSE_TIERS = Array.from({ length: 10 }, (_, i) => ({
  teamValueThreshold: 1750 + i * 150,
  expenseAmount: (i + 1) * 10000,
}))

export function spirallingExpenseFor(
  teamValueK: number,
  tiers: { teamValueThreshold: number; expenseAmount: number }[],
): number {
  const applicable = tiers.filter((t) => teamValueK >= t.teamValueThreshold)
  if (applicable.length === 0) return 0
  return applicable.reduce((best, t) => (t.teamValueThreshold > best.teamValueThreshold ? t : best)).expenseAmount
}
