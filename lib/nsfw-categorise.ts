import { getVerdict, type NsfwScores, type NsfwVerdict } from "./nsfw"

export type ModeratedContentType = "POST" | "SHOP_ITEM" | "AVATAR" | "BANNER" | "COMMISSION_REF"
export type ModerationAction = "PASSED" | "PENDING_REVIEW" | "REMOVED"
export type ModerationStrike = "SEVERE" | "ZERO_TOLERANCE" | null

export type ModerationResult = {
  verdict: NsfwVerdict
  action: ModerationAction
  strikeLevel: ModerationStrike
  violationType: "NONE" | "SUGGESTIVE" | "EXPLICIT_SEXUAL" | "EXPLICIT_HENTAI"
}

export function categorise(scores: NsfwScores, contentType: ModeratedContentType): ModerationResult {
  const verdict = getVerdict(scores)

  if (verdict === "SAFE") {
    return { verdict, action: "PASSED", strikeLevel: null, violationType: "NONE" }
  }

  if (verdict === "SUGGESTIVE") {
    return { verdict, action: "PENDING_REVIEW", strikeLevel: null, violationType: "SUGGESTIVE" }
  }

  const zeroTolerance = contentType === "AVATAR" || contentType === "BANNER"
  return {
    verdict,
    action: "REMOVED",
    strikeLevel: zeroTolerance ? "ZERO_TOLERANCE" : "SEVERE",
    violationType: scores.Hentai > scores.Porn ? "EXPLICIT_HENTAI" : "EXPLICIT_SEXUAL",
  }
}
