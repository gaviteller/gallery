const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

export function isWithin15Days(removedAt: Date | null): boolean {
  if (!removedAt) return false
  return Date.now() - removedAt.getTime() < FIFTEEN_DAYS_MS
}

export const REMOVAL_GRACE_CUTOFF = () => new Date(Date.now() - FIFTEEN_DAYS_MS)
