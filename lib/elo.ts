const K = 32

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400))
}

// actual: 1 = win, 0.5 = draw, 0 = loss
export function newRating(current: number, expected: number, actual: number): number {
  return Math.round(current + K * (actual - expected))
}
