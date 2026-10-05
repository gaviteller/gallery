/**
 * REMOVAL TRANSPARENCY — when moderation removes a post, the artist can still
 * see it (with the reason and an appeal link) for 15 days, then it disappears.
 */
const FIFTEEN_DAYS_MS = 15 * 24 * 60 * 60 * 1000

/** True if a removed post is still inside its 15-day "visible to owner" window. */
export function isWithin15Days(removedAt: Date | null): boolean {
  if (!removedAt) return false
  return Date.now() - removedAt.getTime() < FIFTEEN_DAYS_MS
}

/** Returns the date 15 days ago — removals older than this are no longer shown. */
export const REMOVAL_GRACE_CUTOFF = () => new Date(Date.now() - FIFTEEN_DAYS_MS)
