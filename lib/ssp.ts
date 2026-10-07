export const SSP_THRESHOLDS = [6, 16, 31, 51, 76, 176]

export function getSspInfo(ssp: number): { levelName: string; toNext: number | null; nearPromotion: boolean } {
  let levelName = 'Legend'
  let nextThreshold: number | null = null
  if      (ssp < 6)   { levelName = 'Rookie';        nextThreshold = 6   }
  else if (ssp < 16)  { levelName = 'Experienced';   nextThreshold = 16  }
  else if (ssp < 31)  { levelName = 'Veteran';        nextThreshold = 31  }
  else if (ssp < 51)  { levelName = 'Emerging Star';  nextThreshold = 51  }
  else if (ssp < 76)  { levelName = 'Star';           nextThreshold = 76  }
  else if (ssp < 176) { levelName = 'Super Star';     nextThreshold = 176 }
  const toNext = nextThreshold !== null ? nextThreshold - ssp : null
  return { levelName, toNext, nearPromotion: toNext !== null && toNext <= 3 }
}

export function skillRollsAvailable(ssp: number, rollsRecorded: number): number {
  const levelsCrossed = SSP_THRESHOLDS.filter((t) => ssp >= t).length
  return Math.max(0, levelsCrossed - rollsRecorded)
}

export type StatName = 'MA' | 'ST' | 'AG' | 'AV'

// CRP1 Improvement Table: non-double rolls of 10/11/12 offer a characteristic increase
// as an alternative to a Normal skill; a double always additionally unlocks Double-category skills.
export function improvementOptions(die1: number, die2: number): { isDouble: boolean; statOptions: StatName[] } {
  const sum = die1 + die2
  const statOptions: StatName[] = sum === 10 ? ['MA', 'AV'] : sum === 11 ? ['AG'] : sum === 12 ? ['ST'] : []
  return { isDouble: die1 === die2, statOptions }
}

// CRP1 Value Modifiers Table
export const VALUE_MODIFIERS = {
  normalSkill: 20000,
  doubleSkill: 30000,
  MA: 30000,
  AV: 30000,
  AG: 40000,
  ST: 50000,
} as const

export function canIncreaseStat(baseValue: number, currentIncrease: number): boolean {
  return currentIncrease < 2 && baseValue + currentIncrease + 1 <= 10
}
