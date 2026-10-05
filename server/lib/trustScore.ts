/**
 * TRUST SCORE — the badge shown on artists' commission profiles.
 * Turns a numeric score into a named tier, plus the label and color used in the UI.
 */
export type TrustTier =
  | "excellent"
  | "good"
  | "fair"
  | "poor"
  | "new_artist"
  | "suspended"

/**
 * Compute the Trust Score tier from a final score.
 * Pure function — no side effects, no DB access.
 *
 * @param finalScore  avgRating minus strike deductions, floored at 1.0. null = no ratings yet.
 * @param hasScore    true when the artist has 10+ completed commissions
 * @param isSuspended true when the artist has a Zero Tolerance ban
 */
export function computeTier(
  finalScore: number | null,
  hasScore: boolean,
  isSuspended: boolean
): TrustTier {
  if (isSuspended) return "suspended"
  if (!hasScore || finalScore === null) return "new_artist"
  if (finalScore >= 4.5) return "excellent"
  if (finalScore >= 3.5) return "good"
  if (finalScore >= 2.5) return "fair"
  return "poor"
}

/** Display text for each tier. */
export const TIER_LABELS: Record<TrustTier, string> = {
  excellent: "Excellent",
  good: "Good",
  fair: "Fair",
  poor: "Poor",
  new_artist: "New Artist",
  suspended: "Suspended",
}

/** Badge color for each tier. */
export const TIER_COLORS: Record<TrustTier, string> = {
  excellent: "#4ade80",
  good: "#60a5fa",
  fair: "#facc15",
  poor: "#f87171",
  new_artist: "rgba(255,255,255,0.4)",
  suspended: "#f87171",
}
