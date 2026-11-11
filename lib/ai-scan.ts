/**
 * AI CONTENT MODERATION — TEACHING PHASE: THE AI ONLY INFORMS THE TEAM.
 *
 * Sends new images and text to an AI model (Llama 4 Scout via OpenRouter) that scores them
 * against Gallery's rules. While the AI is still being taught it NEVER blocks anything:
 * no removing, hiding, holding for review, taking down, strikes, or bans. Content stays live.
 * It only writes a flag to the AIScanLog table; the team sees it in the admin panel
 * (Moderation → AI flags), does any moderation themselves, and answers
 * "was the AI right? yes/no" with a reason. That answer is the AI's training feedback.
 *
 * What gets scanned (and by which function):
 *   scanPost        → new posts                 (server/routers/post.ts)
 *   scanShopItem    → new shop listings         (server/routers/shop.ts)
 *   scanAvatar      → profile photos & banners  (server/routers/user.ts)
 *   scanComment     → new comments              (server/routers/interaction.ts)
 *   scanChatMessage → direct messages and commission chat text (dm.ts, commissionMessage.ts)
 * Commission reference photos and DM/commission file attachments are intentionally NOT
 * scanned (private content — report-only).
 *
 * Flag labels (AIScanLog.action) record how sure the AI was:
 *   images: any category 10 → FLAGGED_ZERO_TOLERANCE · any 9 → FLAGGED_SEVERE
 *           clothing/violence/self-harm ≥ 7 → FLAGGED_EXPLICIT · pose ≥ 7 only → FLAGGED_POSE
 *   profile pictures: SUGGESTIVE or worse → FLAGGED_SUGGESTIVE / FLAGGED_EXPLICIT
 *   text (comments, chat): AI verdict REMOVE → FLAGGED
 *   otherwise NONE (still logged for images, so the AI's "looks fine" calls can be audited too).
 *
 * Team feedback (written by the admin panel): overriddenAt/overriddenBy = reviewed when/by whom,
 * overridden = true when the AI was WRONG, reviewNote = the reviewer's reason.
 *
 * If OPENROUTER_API_KEY is missing, every scan is skipped.
 */
import { PrismaClient } from "@prisma/client"

const AI_MODEL = "meta-llama/llama-4-scout"
const AI_REQUEST_TIMEOUT_MS = 30_000

/** Instructions + scoring rubric sent to the AI with every image. */
const IMAGE_MODERATION_PROMPT = `You are the image moderation AI for Gallery, an art platform.

IMPORTANT: These rules apply equally to ALL art styles and mediums — anime, illustration, digital art, photography, realistic, abstract, manga, 3D render. Do not apply different standards based on art style or medium.

=== MINOR DETECTION ===
Judge age by overall body proportions and facial features, NOT height alone. A short character with adult body proportions and adult facial features is NOT a minor. Only flag as minor if the character has BOTH clearly childlike body proportions (no chest/hip development, small frame) AND clearly childlike facial features (round face, large eyes relative to face, small nose, no defined jaw). If a minor is detected AND any category scores 5 or above, return: {"clothing":10,"pose":10,"violence":10,"selfHarm":10,"combined":100,"verdict":"EXPLICIT","reason":"Minor detected in inappropriate content — zero tolerance violation."}

=== SCORING CATEGORIES ===
Rate each 1-10. Judge clothing/pose by what is ACTUALLY VISIBLE, not just what is technically worn. Hair or natural coverage fully concealing the chest = 7 (not 8). Same outfit can score differently depending on angle and what the pose reveals.

CLOTHING/EXPOSURE (weight 30%):
1 = Fully clothed, modest
2 = Fitted/form-fitting but fully covered
3 = Slightly revealing — midriff, low neckline, short skirt, shirtless male
4 = Noticeably revealing — visible cleavage, crop tops, short shorts
5 = Swimwear, lingerie, underwear — technically covered
6 = Very minimal — barely-there, see-through fabric, or hair/natural coverage fully concealing chest
7 = Topless female with hair/arm/object providing clear full coverage OR partial nudity one area just exposed
8 = Mostly exposed — topless female with only minimal coverage (arm barely covering, etc.), only genitals covered
9 = Genitals technically covered but nothing left to imagination (body paint, tape, pasties)
10 = Any nudity with genitals/nipples exposed OR any sexual act — auto-remove

POSE/INTENT (weight 10%):
1 = Neutral everyday pose
2 = Expressive/dynamic — action, dance, athletics, emotional
3 = Confident/alluring — slight lean, hand on hip, artistic
4 = Noticeably suggestive — arched back, holding intimate items, bedroom eyes
5 = Clearly suggestive — spread legs while clothed, hands near intimate areas, deliberate undressing
6 = Overtly sexual — provocative grinding, straddling, deliberately emphasising body parts
7 = Strong sexual implication — actively undressing, pose strongly implies sexual activity
8 = Simulating a sexual act — clearly miming one
9 = Near-explicit — sexual act implied with almost no ambiguity
10 = Explicit sexual act — auto-remove

VIOLENCE/GORE (weight 30%):
1 = No violence
2 = Implied or off-screen — no visible harm
3 = Cartoon/stylised violence — no blood, clear fiction
4 = Mild blood — small wounds in clear fictional context
5 = Moderate gore — visible injuries and blood, clearly narrative/artistic
6 = Strong gore — significant wounds, visceral detail, still has artistic framing
7 = Graphic gore — heavy blood/wounds, artistic context is thin
8 = Severe gore — organs, dismemberment, minimal artistic justification
9 = Extreme gore — purely disturbing, no narrative purpose visible
10 = Gratuitous gore with zero artistic context — shock value only, auto-remove

SELF-HARM (weight 30%):
1 = No self-harm content
2 = Emotional or sad themes — no visible harm
3 = Dark or melancholic aesthetic (dark colours, sad expression, atmospheric) — no wounds or methods
4 = Implied self-harm — bandages or scars but not graphic
5 = Visible old scars or healed wounds in artistic context
6 = Fresh wounds visible but not graphic, or scene strongly associated with self-harm (e.g. graphic depiction of drowning attempt)
7 = Graphic self-inflicted wounds, detailed
8 = Active self-harm being depicted
9 = Glorifying or instructional self-harm imagery
10 = Explicit graphic self-harm with no artistic framing — auto-remove

=== COMBINED SCORE ===
combined = floor((clothing × 30 + pose × 10 + violence × 30 + selfHarm × 30) / 10)

=== VERDICT ===
SAFE = combined 1-49
SUGGESTIVE = combined 50-69
EXPLICIT = combined 70-100

Override rules (apply before calculating verdict):
- Any single category = 10 → combined = 100, verdict = EXPLICIT
- Any single category = 9 → combined = 90, verdict = EXPLICIT
- Clothing OR violence OR selfHarm is 7-8 → verdict = EXPLICIT minimum (combined floor 70)
- Clothing ≥ 6 AND pose ≥ 7 → verdict = SUGGESTIVE minimum (combined floor 50)

Respond with ONLY a JSON object — no markdown, no code blocks:
{"clothing":1,"pose":1,"violence":1,"selfHarm":1,"combined":10,"verdict":"SAFE","reason":"one sentence referencing the specific rule or scale level"}`

/** The AI's scores for one image (each category 1–10, combined 1–100). */
interface ScanScores {
  clothing: number
  pose: number
  violence: number
  selfHarm: number
  combined: number
  verdict: "SAFE" | "SUGGESTIVE" | "EXPLICIT"
  reason: string
}

/** Removes the ```json ... ``` wrapper some models put around their answer. */
function stripCodeFence(aiReply: string): string {
  return aiReply.replace(/^```json\n?/, "").replace(/\n?```$/, "").trim()
}

/** Reads one numeric field (e.g. "clothing": 4) out of a possibly-broken JSON reply. */
function readNumberField(replyText: string, fieldName: string, fallback: number): number {
  const match = replyText.match(new RegExp(`"${fieldName}"\\s*:\\s*(\\d+)`))
  return match ? parseInt(match[1], 10) : fallback
}

/**
 * Sends one request to OpenRouter and returns the AI's text reply.
 * Gives up after 30 seconds. Throws on any HTTP error.
 */
async function askOpenRouter(messageContent: unknown): Promise<string> {
  const abortController = new AbortController()
  const timeoutTimer = setTimeout(() => abortController.abort(), AI_REQUEST_TIMEOUT_MS)

  let response: Response
  try {
    response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      signal: abortController.signal,
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [{ role: "user", content: messageContent }],
      }),
    })
  } finally {
    clearTimeout(timeoutTimer)
  }

  if (!response.ok) throw new Error(`OpenRouter ${response.status}`)
  const responseBody = await response.json()
  return (responseBody.choices?.[0]?.message?.content ?? "").trim()
}

/** Asks the AI to score one image. Tolerates replies that were cut off mid-JSON. */
async function scoreImageWithAI(imageDataUrl: string): Promise<ScanScores> {
  const replyText = stripCodeFence(await askOpenRouter([
    { type: "image_url", image_url: { url: imageDataUrl } },
    { type: "text", text: IMAGE_MODERATION_PROMPT },
  ]))

  try {
    return JSON.parse(replyText) as ScanScores
  } catch {
    // The model sometimes truncates its JSON — salvage each field individually.
    const clothing = readNumberField(replyText, "clothing", 1)
    const pose = readNumberField(replyText, "pose", 1)
    const violence = readNumberField(replyText, "violence", 1)
    const selfHarm = readNumberField(replyText, "selfHarm", 1)
    const combined = readNumberField(replyText, "combined", Math.floor((clothing * 30 + pose * 10 + violence * 30 + selfHarm * 30) / 10))
    const verdictMatch = replyText.match(/"verdict"\s*:\s*"(SAFE|SUGGESTIVE|EXPLICIT)"/)
    const verdict = (verdictMatch?.[1] ?? (combined >= 70 ? "EXPLICIT" : combined >= 50 ? "SUGGESTIVE" : "SAFE")) as ScanScores["verdict"]
    const reasonMatch = replyText.match(/"reason"\s*:\s*"([^"]*)"/)
    const reason = reasonMatch?.[1] ?? "AI response was truncated — manual review recommended."
    return { clothing, pose, violence, selfHarm, combined, verdict, reason }
  }
}


/** Instructions + scoring rubric sent to the AI with every comment. */
const COMMENT_MODERATION_PROMPT = `You are a content moderator for Gallery, an art platform.

Analyze this comment for TOS violations. Rate each category 1-10:

HATE_SPEECH: slurs, dehumanizing language targeting race/gender/religion/sexuality/disability/etc.
HARASSMENT: targeted attacks, threats of violence, doxxing personal information
SPAM: unsolicited ads, repetitive self-promotion, bot-like content, scam links
NSFW_SOLICITATION: sexual solicitation, explicit requests, grooming language

Combined score = floor((hateSpeech×30 + harassment×40 + spam×10 + nsfwSolicitation×20) / 10)
SAFE = combined 1-29, WARNING = 30-59, REMOVE = 60-100

Override rules:
- Any category = 10 → combined = 100, verdict = REMOVE
- harassment ≥ 8 → verdict = REMOVE (combined floor 80)
- hateSpeech ≥ 7 → verdict = REMOVE (combined floor 70)

Respond with ONLY a JSON object — no markdown, no code blocks:
{"hateSpeech":1,"harassment":1,"spam":1,"nsfwSolicitation":1,"combined":7,"verdict":"SAFE","reason":"one sentence"}`

/** The AI's scores for one comment (each category 1–10, combined 1–100). */
interface CommentScores {
  hateSpeech: number
  harassment: number
  spam: number
  nsfwSolicitation: number
  combined: number
  verdict: "SAFE" | "WARNING" | "REMOVE"
  reason: string
}

/** Asks the AI to score one comment. Tolerates replies that were cut off mid-JSON. */
async function scoreCommentWithAI(commentText: string): Promise<CommentScores> {
  const replyText = stripCodeFence(await askOpenRouter(`${COMMENT_MODERATION_PROMPT}\n\nComment: "${commentText}"`))
  try {
    return JSON.parse(replyText) as CommentScores
  } catch {
    const hateSpeech = readNumberField(replyText, "hateSpeech", 1)
    const harassment = readNumberField(replyText, "harassment", 1)
    const spam = readNumberField(replyText, "spam", 1)
    const nsfwSolicitation = readNumberField(replyText, "nsfwSolicitation", 1)
    const combined = readNumberField(replyText, "combined", Math.floor((hateSpeech * 30 + harassment * 40 + spam * 10 + nsfwSolicitation * 20) / 10))
    const verdictMatch = replyText.match(/"verdict"\s*:\s*"(SAFE|WARNING|REMOVE)"/)
    const verdict = (verdictMatch?.[1] ?? (combined >= 60 ? "REMOVE" : combined >= 30 ? "WARNING" : "SAFE")) as CommentScores["verdict"]
    const reasonMatch = replyText.match(/"reason"\s*:\s*"([^"]*)"/)
    const reason = reasonMatch?.[1] ?? "AI response truncated."
    return { hateSpeech, harassment, spam, nsfwSolicitation, combined, verdict, reason }
  }
}

/** Picks the flag label for an image from its scores (see top of file). */
function imageFlag(scores: ScanScores): string {
  const values = [scores.clothing, scores.pose, scores.violence, scores.selfHarm]
  if (values.includes(10)) return "FLAGGED_ZERO_TOLERANCE"
  if (values.includes(9)) return "FLAGGED_SEVERE"
  if (scores.clothing >= 7 || scores.violence >= 7 || scores.selfHarm >= 7) return "FLAGGED_EXPLICIT"
  if (scores.pose >= 7) return "FLAGGED_POSE"
  return "NONE"
}

async function logScanError(prisma: PrismaClient, contentType: string, contentId: string, err: unknown) {
  console.error(`[ai-scan] ${contentType} scan failed:`, err)
  try {
    await prisma.aIScanLog.create({ data: { contentType, contentId, scores: {}, verdict: "ERROR", action: `SCAN_ERROR: ${String(err)}` } })
  } catch {}
}

/** Scores a new comment. If the AI thinks it breaks the rules, the team is informed. */
export async function scanComment(prisma: PrismaClient, commentId: string): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return
  const comment = await prisma.comment.findUnique({ where: { id: commentId }, select: { text: true } })
  if (!comment) return
  let scores: CommentScores
  try { scores = await scoreCommentWithAI(comment.text) } catch (err) { return logScanError(prisma, "COMMENT", commentId, err) }
  if (scores.verdict !== "REMOVE") return
  await prisma.aIScanLog.create({
    data: { contentType: "COMMENT", contentId: commentId, scores: scores as object, verdict: scores.verdict, action: "FLAGGED" },
  }).catch((err) => console.error("[ai-scan] comment log failed:", err))
}

/** Scores a chat message's text (direct message or commission thread). Informs the team only. */
export async function scanChatMessage(prisma: PrismaClient, kind: "DM" | "COMMISSION", messageId: string): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return
  const message = kind === "DM"
    ? await prisma.directMessage.findUnique({ where: { id: messageId }, select: { text: true } })
    : await prisma.professionalMessage.findUnique({ where: { id: messageId }, select: { text: true } })
  if (!message?.text?.trim()) return
  const contentType = kind === "DM" ? "DM_MESSAGE" : "COMMISSION_MESSAGE"
  let scores: CommentScores
  try { scores = await scoreCommentWithAI(message.text) } catch (err) { return logScanError(prisma, contentType, messageId, err) }
  if (scores.verdict !== "REMOVE") return
  await prisma.aIScanLog.create({
    data: { contentType, contentId: messageId, scores: scores as object, verdict: scores.verdict, action: "FLAGGED" },
  }).catch((err) => console.error("[ai-scan] chat log failed:", err))
}

/** Scores a new shop listing's preview image and records the AI's opinion. Informs the team only. */
export async function scanShopItem(prisma: PrismaClient, itemId: string, _userId: string, imageDataUrl: string): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return
  let scores: ScanScores
  try { scores = await scoreImageWithAI(imageDataUrl) } catch (err) { return logScanError(prisma, "SHOP_ITEM", itemId, err) }
  try {
    await prisma.shopItem.update({ where: { id: itemId }, data: { aiVerdict: scores.verdict, aiScores: scores as object } })
    await prisma.aIScanLog.create({ data: { contentType: "SHOP_ITEM", contentId: itemId, scores: scores as object, verdict: scores.verdict, action: imageFlag(scores) } })
  } catch (err) {
    console.error("[ai-scan] DB update failed (shop):", err)
  }
}

/** Scores a new profile photo / banner. The picture stays up; the team is informed if it's flagged. */
export async function scanAvatar(prisma: PrismaClient, userId: string, field: "image" | "bannerImage", imageDataUrl: string): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return
  let scores: ScanScores
  try { scores = await scoreImageWithAI(imageDataUrl) } catch (err) { return logScanError(prisma, "AVATAR", userId, err) }
  if (scores.verdict === "SAFE") return
  await prisma.aIScanLog.create({
    data: {
      contentType: "AVATAR",
      contentId: userId,
      scores: { ...scores, image: imageDataUrl, field } as object,
      verdict: scores.verdict,
      action: scores.verdict === "EXPLICIT" ? "FLAGGED_EXPLICIT" : "FLAGGED_SUGGESTIVE",
    },
  }).catch((err) => console.error("[ai-scan] avatar log failed:", err))
}

/**
 * Scores a new post's image and records the AI's opinion. Informs the team only.
 * Also re-run by the report flow when a reported post was never scanned.
 */
export async function scanPost(prisma: PrismaClient, postId: string, _userId: string, imageDataUrl: string): Promise<void> {
  if (!process.env.OPENROUTER_API_KEY) return
  let scores: ScanScores
  try { scores = await scoreImageWithAI(imageDataUrl) } catch (err) { return logScanError(prisma, "POST", postId, err) }
  try {
    await prisma.post.update({ where: { id: postId }, data: { aiVerdict: scores.verdict, aiScores: scores as object } })
    await prisma.aIScanLog.create({ data: { contentType: "POST", contentId: postId, scores: scores as object, verdict: scores.verdict, action: imageFlag(scores) } })
  } catch (err) {
    console.error("[ai-scan] DB update failed (post):", err)
  }
}
